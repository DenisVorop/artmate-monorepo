import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function evaluateTypeScript(source, mocks = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) {
      return mocks[specifier];
    }

    return require(specifier);
  };

  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

async function loadApiResultModules() {
  const omitUndefined = evaluateTypeScript(await readSource("src/shared/lib/omit-undefined.ts"));
  const apiError = evaluateTypeScript(await readSource("src/shared/lib/api-result/api-error.ts"), {
    "../omit-undefined": omitUndefined,
  });
  const apiResult = evaluateTypeScript(await readSource("src/shared/lib/api-result/api-result.ts"), {
    "../omit-undefined": omitUndefined,
    "./api-error": apiError,
  });
  const baseApiModel = evaluateTypeScript(
    await readSource("src/shared/lib/api-result/base-api-model.ts"),
    {
      "../omit-undefined": omitUndefined,
      "./api-error": apiError,
    },
  );

  return { ...apiError, ...apiResult, ...baseApiModel };
}

test("public ApiResult and BaseApiModel DTOs omit server stack traces", async () => {
  const apiErrorSource = await readSource("src/shared/lib/api-result/api-error.ts");
  const apiErrorDtoContract = apiErrorSource.match(/export type ApiErrorDTO = \{([\s\S]*?)\n\};/u)?.[1];
  const { ApiResult, BaseApiModel } = await loadApiResultModules();
  const serverError = new Error("database connection failed");
  const result = ApiResult.error(serverError);

  assert.ok(result.error instanceof Error);
  assert.equal(result.error.stack, serverError.stack);
  assert.deepEqual(result.toDTO().error, {
    message: "database connection failed",
    name: "ApiError",
    status: 500,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)).error, {
    message: "database connection failed",
    name: "ApiError",
    status: 500,
  });
  assert.doesNotMatch(apiErrorDtoContract, /\bstack\??\s*:/u);

  class TestApiModel extends BaseApiModel {
    transform(data) {
      return data;
    }
  }

  const model = TestApiModel.FromApiResult(result);
  assert.equal(model.error.stack, serverError.stack);
  assert.deepEqual(model.toDTO().error, {
    message: "database connection failed",
    name: "ApiError",
    status: 500,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(model)).error, {
    message: "database connection failed",
    name: "ApiError",
    status: 500,
  });
});

test("checkout order action failure does not return a server stack trace", async () => {
  const apiResultModules = await loadApiResultModules();
  const { createOrder } = evaluateTypeScript(
    await readSource("src/shared/actions/orders/orders.actions.ts"),
    {
      "@/shared/lib/api-result": apiResultModules,
      "@/shared/lib/api-security": {
        apiCsrfHeader: {},
        getForwardedIpHeaders: () => ({}),
      },
      "next/headers": {
        cookies: async () => ({ get: () => undefined }),
        headers: async () => new Headers(),
      },
    },
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("private upstream failure");
  };

  try {
    const result = await createOrder({});

    assert.equal(result.status, "error");
    assert.equal(result.error.message, "Не удалось оформить заказ. Попробуйте еще раз.");
    assert.equal(result.error.name, "ApiError");
    assert.equal(result.error.status, 500);
    assert.equal(Object.hasOwn(result.error, "stack"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkout Server Actions replace provider errors with operation-safe DTOs", async () => {
  const apiResultModules = await loadApiResultModules();
  const headerMocks = {
    cookies: async () => ({ get: () => undefined }),
    headers: async () => new Headers(),
  };
  const commonMocks = {
    "@/shared/lib/api-result": apiResultModules,
    "@/shared/lib/api-security": {
      apiCsrfHeader: {},
      getForwardedIpHeaders: () => ({}),
    },
    "next/headers": headerMocks,
  };
  const orderActions = evaluateTypeScript(
    await readSource("src/shared/actions/orders/orders.actions.ts"),
    commonMocks,
  );
  const deliveryActions = evaluateTypeScript(
    await readSource("src/shared/actions/delivery/delivery.actions.ts"),
    commonMocks,
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        body: "PRIVATE_PROVIDER_BODY_SENTINEL",
        details: "PRIVATE_PROVIDER_DETAILS_SENTINEL",
        message: "PRIVATE_PROVIDER_MESSAGE_SENTINEL",
        providerStatus: 599,
      }),
      { headers: { "content-type": "application/json" }, status: 502 },
    );

  try {
    const cases = [
      [() => orderActions.createOrder({}), "Не удалось оформить заказ. Попробуйте еще раз."],
      [
        () => orderActions.calculateCheckout({ delivery: { provider: "ozon" } }),
        "Не удалось рассчитать заказ. Попробуйте еще раз.",
      ],
      [
        () =>
          deliveryActions.getOzonDeliveryMap({
            viewport: {
              leftBottom: { lat: 55.5, long: 37.3 },
              rightTop: { lat: 55.9, long: 37.8 },
            },
            zoom: 11,
          }),
        "Не удалось загрузить карту пунктов Ozon. Попробуйте еще раз.",
      ],
      [
        () => deliveryActions.getOzonDeliveryPoints(["point-1"]),
        "Не удалось загрузить пункты выдачи Ozon. Попробуйте еще раз.",
      ],
    ];

    for (const [action, message] of cases) {
      const result = await action();
      const serialized = JSON.stringify(result);

      assert.deepEqual(result, {
        error: { message, name: "ApiError", status: 500 },
        isEmpty: false,
        isError: true,
        isSuccess: false,
        status: "error",
      });
      assert.doesNotMatch(serialized, /PRIVATE_PROVIDER|599|body|details|providerStatus/u);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkout order actions preserve safe buyer validation messages", async () => {
  const apiResultModules = await loadApiResultModules();
  const { calculateCheckout } = evaluateTypeScript(
    await readSource("src/shared/actions/orders/orders.actions.ts"),
    {
      "@/shared/lib/api-result": apiResultModules,
      "@/shared/lib/api-security": {
        apiCsrfHeader: {},
        getForwardedIpHeaders: () => ({}),
      },
      "next/headers": {
        cookies: async () => ({ get: () => undefined }),
        headers: async () => new Headers(),
      },
    },
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Cart is empty" }), {
      headers: { "content-type": "application/json" },
      status: 400,
    });

  try {
    const result = await calculateCheckout({ delivery: { provider: "ozon" } });
    assert.equal(result.error.message, "Cart is empty");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkout Server Actions sanitize transport error messages", async () => {
  const apiResultModules = await loadApiResultModules();
  const commonMocks = {
    "@/shared/lib/api-result": apiResultModules,
    "@/shared/lib/api-security": {
      apiCsrfHeader: {},
      getForwardedIpHeaders: () => ({}),
    },
    "next/headers": {
      cookies: async () => ({ get: () => undefined }),
      headers: async () => new Headers(),
    },
  };
  const orderActions = evaluateTypeScript(
    await readSource("src/shared/actions/orders/orders.actions.ts"),
    commonMocks,
  );
  const deliveryActions = evaluateTypeScript(
    await readSource("src/shared/actions/delivery/delivery.actions.ts"),
    commonMocks,
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("PRIVATE_PROVIDER_TRANSPORT_SENTINEL");
  };

  try {
    const cases = [
      [() => orderActions.createOrder({}), "Не удалось оформить заказ. Попробуйте еще раз."],
      [
        () => orderActions.calculateCheckout({ delivery: { provider: "ozon" } }),
        "Не удалось рассчитать заказ. Попробуйте еще раз.",
      ],
      [
        () =>
          deliveryActions.getOzonDeliveryMap({
            viewport: {
              leftBottom: { lat: 55.5, long: 37.3 },
              rightTop: { lat: 55.9, long: 37.8 },
            },
            zoom: 11,
          }),
        "Не удалось загрузить карту пунктов Ozon. Попробуйте еще раз.",
      ],
      [
        () => deliveryActions.getOzonDeliveryPoints(["point-1"]),
        "Не удалось загрузить пункты выдачи Ozon. Попробуйте еще раз.",
      ],
    ];

    for (const [action, message] of cases) {
      const result = await action();
      assert.equal(result.error.message, message);
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PROVIDER_TRANSPORT_SENTINEL/u);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("query hydration omits stack traces without mutating the server Error", async () => {
  const { QueryClient } = require("@tanstack/react-query");
  const { dehydrateQueryClient } = evaluateTypeScript(
    await readSource("src/shared/lib/dehydrate-query-client.ts"),
  );
  const queryClient = new QueryClient();
  const serverError = new Error("private query failure");
  serverError.name = "QueryUpstreamError";
  serverError.status = 503;
  const query = queryClient.getQueryCache().build(queryClient, {
    queryKey: ["failing-query"],
    queryFn: async () => undefined,
  });
  query.setState({
    ...query.state,
    error: serverError,
    fetchFailureReason: serverError,
    fetchStatus: "idle",
    status: "error",
  });

  const dehydratedState = dehydrateQueryClient(queryClient);
  const publicState = dehydratedState.queries[0].state;

  assert.deepEqual(publicState.error, {
    message: "private query failure",
    name: "QueryUpstreamError",
    status: 503,
  });
  assert.deepEqual(publicState.fetchFailureReason, {
    message: "private query failure",
    name: "QueryUpstreamError",
    status: 503,
  });
  assert.match(serverError.stack, /private query failure/u);
  assert.equal(serverError.name, "QueryUpstreamError");
  assert.equal(serverError.status, 503);
});

test("paused mutation hydration omits stack traces and preserves public error fields", async () => {
  const { QueryClient } = require("@tanstack/react-query");
  const { dehydrateQueryClient } = evaluateTypeScript(
    await readSource("src/shared/lib/dehydrate-query-client.ts"),
  );
  const queryClient = new QueryClient();
  const serverError = new Error("private mutation failure");
  serverError.name = "MutationUpstreamError";
  serverError.status = 429;
  queryClient.getMutationCache().build(
    queryClient,
    { mutationKey: ["paused-mutation"] },
    {
      context: undefined,
      data: undefined,
      error: serverError,
      failureCount: 1,
      failureReason: serverError,
      isPaused: true,
      status: "pending",
      submittedAt: Date.now(),
      variables: { orderId: "order-1" },
    },
  );

  const dehydratedState = dehydrateQueryClient(queryClient);
  const publicState = dehydratedState.mutations[0].state;

  assert.equal(publicState.error.message, "private mutation failure");
  assert.equal(publicState.error.name, "MutationUpstreamError");
  assert.equal(publicState.error.status, 429);
  assert.equal(Object.hasOwn(publicState.error, "stack"), false);
  assert.equal(publicState.failureReason.message, "private mutation failure");
  assert.equal(publicState.failureReason.name, "MutationUpstreamError");
  assert.equal(publicState.failureReason.status, 429);
  assert.equal(Object.hasOwn(publicState.failureReason, "stack"), false);
  assert.match(serverError.stack, /private mutation failure/u);
  assert.equal(serverError.name, "MutationUpstreamError");
  assert.equal(serverError.status, 429);
});
