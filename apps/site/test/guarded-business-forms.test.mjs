import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
function evaluate(source, mocks = {}) {
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
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const fixtures = {
  partner: {
    feature: "partner-application",
    hook: "usePartnerApplicationState",
    path: "use-partner-application-state",
    model: "useSubmitPartnerApplication",
    action: "submitPartnerApplication",
    values: {
      name: "Анна",
      email: "reply@example.com",
      channelUrl: "https://example.com/blog",
      partnerType: "creator",
      audienceSize: "up_to_1000",
      preferredContact: "telegram",
      contactHandle: "@annatest",
      comment: "Давайте сотрудничать",
      website: "",
    },
    invalid: { channelUrl: "broken" },
    response: { accepted: true },
  },
};
async function loadForms(kind) {
  const config = fixtures[kind];
  const telegram = evaluate(await read(`features/${config.feature}/lib/telegram-contact.ts`));
  const types = evaluate(
    await read("shared/actions/partner-applications/partner-applications.types.ts"),
  );
  const schemas = evaluate(await read(`features/${config.feature}/lib/form-values.ts`), {
    "@/shared/actions/partner-applications": types,
    "./telegram-contact": telegram,
  });
  const mapper = evaluate(await read(`features/${config.feature}/lib/payload.ts`), {
    "./telegram-contact": telegram,
  });
  return { config, schemas, mapper };
}
async function harness(kind) {
  const { config, schemas, mapper } = await loadForms(kind);
  const states = [],
    refs = [],
    authRequests = [],
    submitted = [],
    events = [];
  let stateIndex = 0,
    refIndex = 0,
    authOptions,
    authPending = false,
    resets = 0;
  let business = async () => config.response;
  let mutationError = null;
  const schema = schemas.partnerApplicationFormSchema;
  const form = {
    reset() {
      resets++;
    },
    handleSubmit: (submit) => async (values) => {
      const parsed = schema.safeParse(values);
      if (parsed.success) return submit(parsed.data);
    },
  };
  const hooks = evaluate(await read(`features/${config.feature}/lib/${config.path}.ts`), {
    react: {
      useState: (initial) => {
        const i = stateIndex++;
        if (!(i in states)) states[i] = initial;
        return [
          states[i],
          (value) => {
            states[i] = value;
          },
        ];
      },
      useRef: (initial) => {
        const i = refIndex++;
        return (refs[i] ??= { current: initial });
      },
      useEffect() {},
    },
    "react-hook-form": { useForm: () => form },
    "@hookform/resolvers/zod": { zodResolver: () => undefined },
    "@/features/auth": {
      useAuth: (options) => {
        authOptions = options;
        return {
          isPending: authPending,
          onAuth: (payload) => {
            const completion = deferred();
            authRequests.push({ payload, options: authOptions, completion });
            authPending = true;
            return completion.promise.finally(() => {
              authPending = false;
            });
          },
        };
      },
    },
    "../model": {
      [config.model]: () => ({
        [config.action]: async (payload) => {
          submitted.push(payload);
          return business(payload);
        },
        isPending: false,
        error: mutationError,
        reset() {},
      }),
    },
    "./analytics": {
      trackPartnerProgramEvent: (event) => events.push(event),
    },
    "./form-values": schemas,
    "./payload": mapper,
  });
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    return hooks[config.hook]();
  };
  async function succeed(index = 0) {
    const request = authRequests[index];
    try {
      await request.options.onSuccess(
        { id: "fresh-actor", email: "actor@example.com" },
        request.payload,
      );
      request.completion.resolve({ status: "success" });
    } catch (error) {
      request.completion.reject(error);
    }
  }
  function cancel(index = 0) {
    const request = authRequests[index];
    request.options.onError({ code: "cancelled" }, request.payload);
    request.completion.resolve({
      status: "error",
      error: { code: "cancelled" },
    });
  }
  return {
    render,
    authRequests,
    submitted,
    events,
    succeed,
    cancel,
    setBusiness(value) {
      business = value;
    },
    setMutationError(value) {
      mutationError = value;
    },
    get resets() {
      return resets;
    },
  };
}
for (const kind of Object.keys(fixtures)) {
  const config = fixtures[kind];
  test(`${kind}: validation runs before auth and a business request`, async () => {
    const h = await harness(kind);
    await h.render().submitForm({ ...config.values, ...config.invalid });
    assert.equal(h.authRequests.length, 0);
    assert.equal(h.submitted.length, 0);
  });
  test(`${kind}: captures immutable payload before auth and keeps a separate reply email`, async () => {
    const h = await harness(kind);
    const input = { ...config.values };
    const pending = h.render().submitForm(input);
    input.email = "changed@example.com";
    input.name = "Другое имя";
    assert.equal(h.authRequests.length, 1);
    assert.ok(Object.isFrozen(h.authRequests[0].payload));
    assert.equal(h.submitted.length, 0);
    await h.succeed();
    await pending;
    assert.equal(h.submitted[0].email, "reply@example.com");
    assert.equal(h.submitted[0].name, "Анна");
    assert.equal(h.resets, 1);
    assert.equal(h.render().sent, true);
    assert.equal("acceptedPersonalDataConsent" in h.submitted[0], false);
    assert.equal("consent" in h.submitted[0], false);
  });
  test(`${kind}: cancellation preserves form and retry sends exactly once`, async () => {
    const h = await harness(kind);
    const pending = h.render().submitForm(config.values);
    h.cancel();
    await pending;
    assert.equal(h.submitted.length, 0);
    assert.equal(h.resets, 0);
    assert.equal(h.render().sent, false);
    assert.equal(h.render().submitError, undefined);
    assert.equal(h.events.includes("partner_form_error"), false);
    const retry = h.render().submitForm(config.values);
    await h.succeed(1);
    await retry;
    assert.equal(h.submitted.length, 1);
  });
  test(`${kind}: repeated submit during auth cannot replace the captured payload or duplicate mutation`, async () => {
    const h = await harness(kind);
    const pending = h.render().submitForm(config.values);
    await h.render().submitForm({ ...config.values, email: "another@example.com" });
    assert.equal(h.authRequests.length, 1);
    await h.succeed();
    await pending;
    assert.equal(h.submitted.length, 1);
    assert.equal(h.submitted[0].email, "reply@example.com");
  });
  test(`${kind}: successful auth alone does not reset or show business success`, async () => {
    const h = await harness(kind);
    const business = deferred();
    h.setBusiness(() => business.promise);
    const pending = h.render().submitForm(config.values);
    const continuation = h.succeed();
    assert.equal(h.submitted.length, 1);
    assert.equal(h.resets, 0);
    assert.equal(h.render().sent, false);
    assert.equal(h.events.includes("partner_form_success"), false);
    await h.render().submitForm(config.values);
    assert.equal(h.authRequests.length, 1);
    business.resolve(config.response);
    await continuation;
    await pending;
    assert.equal(h.resets, 1);
    assert.equal(h.render().sent, true);
    if (kind === "partner") assert.deepEqual(h.events, ["partner_form_success"]);
  });
  test(`${kind}: failed business request preserves fields and never claims success`, async () => {
    const h = await harness(kind);
    h.setBusiness(async () => {
      throw new Error("request failed");
    });
    const pending = h.render().submitForm(config.values);
    await h.succeed();
    await pending;
    assert.equal(h.resets, 0);
    assert.equal(h.render().sent, false);
    if (kind === "partner") assert.deepEqual(h.events, ["partner_form_error"]);
  });
  test(`${kind}: transport forwards only access cookie with CSRF and available request context`, async () => {
    const filename = "partner-applications";
    const calls = [];
    const savedFetch = globalThis.fetch;
    const action = evaluate(await read(`shared/actions/${filename}/${filename}.actions.ts`), {
      "next/headers": {
        cookies: async () => ({
          get: (key) =>
            key === "artmate_access_token"
              ? { value: "secret/= value" }
              : { value: "foreign-cookie" },
        }),
        headers: async () => new Headers({ "x-real-ip": "127.0.0.99" }),
      },
      "@/shared/lib/api-security": {
        apiCsrfHeader: { "x-artmate-csrf": "1" },
        getForwardedIpHeaders: (headers) => ({
          "x-real-ip": headers.get("x-real-ip"),
        }),
      },
      "@/shared/lib/api-result": {
        ApiResult: {
          prepareApi: (call) => async () => ({
            toDTO: () => ({ data: calls.length && config.response }),
            result: await call(),
          }),
        },
      },
    });
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => config.response };
    };
    try {
      await action[config.action]({ ...config.values });
      assert.equal(calls[0].init.headers.cookie, "artmate_access_token=secret%2F%3D%20value");
      assert.equal(calls[0].init.headers["x-artmate-csrf"], "1");
      assert.equal(calls[0].init.headers["x-real-ip"], "127.0.0.99");
      assert.equal(calls[0].init.cache, "no-store");
      assert.equal(calls[0].init.method, "POST");
      assert.equal(JSON.stringify(calls[0].init).includes("foreign-cookie"), false);
      assert.equal(JSON.parse(calls[0].init.body).email, "reply@example.com");
    } finally {
      globalThis.fetch = savedFetch;
    }
  });
  test(`${kind}: unexpected transport errors never expose their raw message`, async () => {
    const h = await harness(kind);
    h.setMutationError(new Error("secret=private-server-token; upstream failed"));
    assert.match(h.render().submitError, /Не удалось отправить/u);
    assert.equal(h.render().submitError.includes("private-server-token"), false);
  });
  test(`${kind}: mutation accepts DTO only and rejects absent or unsuccessful server acknowledgement`, async () => {
    let options, response;
    const mod = evaluate(
      await read(`features/${config.feature}/model/use-submit-partner-application.ts`),
      {
        "@tanstack/react-query": {
          useMutation: (value) => {
            options = value;
            return {};
          },
        },
        [`@/shared/actions/${kind === "contact" ? "contact-form" : "partner-applications"}`]: {
          [config.action]: async () => response,
        },
        "@/shared/lib/api-result": {
          ApiResult: { fromDTO: (value) => ({ isError: false, data: value }) },
        },
      },
    );
    mod[config.model]();
    response = undefined;
    await assert.rejects(options.mutationFn(config.values), /Не удалось отправить/u);
    response = { accepted: false };
    await assert.rejects(options.mutationFn(config.values), /Не удалось отправить/u);
    response = config.response;
    assert.deepEqual(await options.mutationFn(config.values), config.response);
  });
}

test("partner: UTM and Telegram are captured before auth, unaffected by navigation", async () => {
  const previous = globalThis.window;
  globalThis.window = {
    location: { search: "?utm_source=first&utm_campaign=signup" },
  };
  try {
    const h = await harness("partner");
    const pending = h.render().submitForm(fixtures.partner.values);
    globalThis.window.location.search = "?utm_source=changed";
    await h.succeed();
    await pending;
    assert.equal(h.submitted[0].utmSource, "first");
    assert.equal(h.submitted[0].utmCampaign, "signup");
    assert.equal(h.submitted[0].contactHandle, "@annatest");
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test("partner analytics: typed shared transport preserves consent and exact existing IDs without PII", async () => {
  const types = evaluate(await read("shared/lib/analytics/types.ts"));
  const product = evaluate(await read("shared/lib/analytics/product.ts"));
  const sanitizer = evaluate(await read("shared/lib/analytics/sanitize-analytics-url.ts"));
  const dedupe = evaluate(await read("shared/lib/analytics/dedupe.ts"));
  const consent = evaluate(await read("shared/lib/cookie-consent/cookie-consent-store.ts"));
  const transport = evaluate(await read("shared/lib/analytics/create-analytics.ts"), {
    "./types": types,
    "./product": product,
    "./sanitize-analytics-url": sanitizer,
    "./dedupe": dedupe,
    "@/shared/lib/cookie-consent": consent,
  });
  const feature = evaluate(await read("features/partner-application/lib/analytics.ts"), {
    "@/shared/lib/analytics": transport,
  });
  const events = [
    "partner_cta_click",
    "partner_form_start",
    "partner_form_success",
    "partner_form_error",
  ];
  const saved = globalThis.window;
  delete globalThis.window;
  feature.trackPartnerProgramEvent("partner_form_success"); // SSR no-op
  const ym = [],
    google = [],
    layer = [];
  const storage = new Map();
  globalThis.window = {
    ym: (...args) => ym.push(args),
    gtag: (...args) => google.push(args),
    dataLayer: layer,
    document: { getElementById: () => ({ getAttribute: () => "123" }) },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
  try {
    events.forEach(feature.trackPartnerProgramEvent);
    assert.deepEqual(ym, []);
    assert.deepEqual(google, []);
    assert.deepEqual(layer, []);
    consent.acceptCookieConsent();
    events.forEach(feature.trackPartnerProgramEvent);
    assert.deepEqual(
      ym,
      events.map((event) => [123, "reachGoal", event]),
    );
    assert.deepEqual(
      google,
      events.map((event) => ["event", event, { event_category: "partner_program" }]),
    );
    assert.deepEqual(layer, []); // Preserve pre-existing transport, no new duplicate dataLayer goal.
    const unsafe = transport.createAnalytics({
      unsafe: () => ({
        kind: "goal",
        eventId: "partner_form_success",
        params: { email: "private@example.com", user_id: "private-user" },
      }),
    });
    unsafe.send("unsafe");
    assert.equal(JSON.stringify({ ym, google, layer }).includes("private"), false);
    globalThis.window.gtag = () => {
      throw new Error("blocked");
    };
    globalThis.window.ym = () => {
      throw new Error("blocked");
    };
    assert.doesNotThrow(() => feature.trackPartnerProgramEvent("partner_form_success"));
  } finally {
    if (saved === undefined) delete globalThis.window;
    else globalThis.window = saved;
  }
});
