import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function load(path, mocks = {}) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

test("joining requires explicit consent and sends the server terms version", async () => {
  const { enrollmentFormSchema, toEnrollmentInput } = await load(
    "features/loyalty-cabinet/lib/enrollment-form.ts",
  );
  assert.equal(enrollmentFormSchema.safeParse({ acceptedTerms: false }).success, false);
  assert.equal(enrollmentFormSchema.safeParse({}).success, false);
  assert.throws(() => toEnrollmentInput({ acceptedTerms: false }, "terms-2"));
  assert.deepEqual(toEnrollmentInput({ acceptedTerms: true }, "terms-2"), {
    acceptedTerms: true,
    termsVersion: "terms-2",
  });
});

test("reservation and release describe held points without duplicating a balance debit", async () => {
  const { getOperationPresentation } = await load("entities/loyalty/lib/format.ts");
  const reserve = getOperationPresentation({
    kind: "reserve",
    balanceDelta: 0,
    reservedDelta: 50,
    balanceAfter: 100,
  });
  assert.equal(reserve.amount, "50 б");
  assert.match(reserve.detail, /ещё не списано/u);
  const consume = getOperationPresentation({
    kind: "consume",
    balanceDelta: -50,
    reservedDelta: -50,
    balanceAfter: 50,
  });
  assert.equal(consume.amount, "−50 б");
  const release = getOperationPresentation({
    kind: "release",
    balanceDelta: 0,
    reservedDelta: -50,
    balanceAfter: 100,
  });
  assert.equal(release.amount, "50 б");
  assert.match(release.detail, /снова доступны/u);
  const credit = getOperationPresentation({
    kind: "credit",
    balanceDelta: 25,
    reservedDelta: 0,
    balanceAfter: 125,
  });
  assert.equal(credit.amount, "+25 б");
  assert.equal(credit.tone, "positive");
});

test("overview, dashboard and paginated operations cache identities are scoped to the user", async () => {
  const schemas = await load("entities/loyalty/model/types.ts");
  const { loyaltyQuery } = await load("entities/loyalty/model/query.ts", {
    "@/shared/actions/loyalty": {},
    "@/shared/lib/api-result": {},
    "./types": schemas,
  });
  for (const method of ["overview", "dashboard", "operations"]) {
    assert.notDeepEqual(
      loyaltyQuery[method]("alice").queryKey,
      loyaltyQuery[method]("bob").queryKey,
    );
    assert.deepEqual(
      loyaltyQuery[method]("alice").queryKey.slice(0, 2),
      loyaltyQuery.userKey("alice"),
    );
    assert.equal(loyaltyQuery[method]("alice").retry, false);
  }
  assert.notDeepEqual(
    loyaltyQuery.operations("alice").queryKey,
    loyaltyQuery.operations("alice", "21").queryKey,
  );
});

test("automatic refresh runs only while history is pending and stops after failure, logout or completion", async () => {
  let options;
  const { loyaltyRefreshInterval, useLoyaltyData } = await load(
    "entities/loyalty/model/use-loyalty-data.ts",
    {
      "@tanstack/react-query": {
        useQuery: (value) => {
          options = value;
          return {};
        },
      },
      "./query": { loyaltyQuery: { overview: () => ({}) } },
    },
  );
  const pending = { member: { status: "active", historyState: "pending" } };
  assert.equal(loyaltyRefreshInterval(pending, false), 15_000);
  assert.equal(loyaltyRefreshInterval(pending, true), false);
  assert.equal(loyaltyRefreshInterval(undefined, false), false);
  assert.equal(loyaltyRefreshInterval({ member: null }, false), false);
  assert.equal(
    loyaltyRefreshInterval({ member: { status: "blocked", historyState: "pending" } }, false),
    false,
  );
  for (const historyState of ["ready", "failed"])
    assert.equal(
      loyaltyRefreshInterval({ member: { status: "active", historyState } }, false),
      false,
    );
  useLoyaltyData("alice", false);
  assert.equal(options.enabled, false);
  assert.equal(options.refetchInterval({ state: { data: pending, status: "success" } }), false);
  useLoyaltyData("alice", true);
  assert.equal(options.refetchInterval({ state: { data: pending, status: "error" } }), false);
  assert.equal(options.refetchInterval({ state: { data: pending, status: "success" } }), 15_000);
});

test("in-flight query cancellation discards a response after logout", async () => {
  const schemas = await load("entities/loyalty/model/types.ts");
  const controller = new AbortController();
  const { loyaltyQuery } = await load("entities/loyalty/model/query.ts", {
    "@/shared/actions/loyalty": {
      getMyLoyalty: async () => {
        controller.abort();
        return {};
      },
    },
    "@/shared/lib/api-result": {
      ApiResult: {
        fromDTO: () => {
          throw new Error("Cancelled response must not be parsed");
        },
      },
    },
    "./types": schemas,
  });
  await assert.rejects(loyaltyQuery.overview("alice").queryFn({ signal: controller.signal }), {
    name: "AbortError",
  });
});

test("server action rejects an account mismatch before accessing private loyalty endpoints", async () => {
  let requests = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error("Unexpected fetch");
  };
  try {
    const apiResult = {
      fromDTO: (dto) => dto,
      prepareApi: (fn) => async () => {
        try {
          const data = await fn();
          return { toDTO: () => ({ data }) };
        } catch (error) {
          return { toDTO: () => ({ error: { message: error.message, status: error.status } }) };
        }
      },
    };
    const actions = await load("shared/actions/loyalty/loyalty.actions.ts", {
      "next/headers": {
        cookies: async () => {
          throw new Error("Unexpected cookies access");
        },
        headers: async () => ({}),
      },
      "@/shared/actions/auth": { getAuthSession: async () => ({ data: { user: { id: "bob" } } }) },
      "@/shared/lib/api-result": { ApiResult: apiResult },
      "@/shared/lib/api-security": {},
    });
    const response = await actions.getMyLoyalty("alice");
    assert.equal(response.error.status, 401);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
