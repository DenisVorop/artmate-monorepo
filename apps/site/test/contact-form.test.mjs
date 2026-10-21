import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
function evaluate(source, mocks = {}) {
  const loaded = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  )((name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)), loaded, loaded.exports);
  return loaded.exports;
}
const schema = evaluate(await read("features/contact-form/lib/form-values.ts"));
const { buildContactMessagePayload } = evaluate(
  await read("features/contact-form/lib/contact-message-payload.ts"),
);
const values = {
  name: "Анна",
  email: "reply@example.test",
  message: "Вопрос по заказу",
  order: "",
  topic: "",
  acceptedPersonalDataConsent: true,
};

async function harness() {
  const states = [],
    refs = [],
    submitted = [];
  let stateIndex = 0,
    refIndex = 0,
    resets = 0,
    error = null;
  let business = async () => ({ sent: true });
  const form = {
    reset() {
      resets++;
    },
    handleSubmit: (submit) => async (input) => {
      const parsed = schema.contactFormSchema.safeParse(input);
      if (parsed.success) await submit(parsed.data);
    },
  };
  const hooks = evaluate(await read("features/contact-form/lib/use-contact-form-state.ts"), {
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
      useRef: (initial) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
    },
    "react-hook-form": { useForm: () => form },
    "@hookform/resolvers/zod": { zodResolver: () => undefined },
    "../model": {
      useSubmitContactMessageMutation: () => ({
        submitContactMessage: async (payload) => {
          submitted.push(payload);
          return business(payload);
        },
        reset() {
          error = null;
        },
        isPending: false,
        error,
      }),
    },
    "./form-values": schema,
    "./contact-message-payload": { buildContactMessagePayload },
  });
  return {
    render() {
      stateIndex = 0;
      refIndex = 0;
      return hooks.useContactFormState();
    },
    submitted,
    get resets() {
      return resets;
    },
    setBusiness(action) {
      business = action;
    },
    setError(value) {
      error = value;
    },
  };
}

test("contact: consent starts unchecked and false/missing/string values cannot submit", async () => {
  assert.equal(schema.contactFormDefaultValues.acceptedPersonalDataConsent, false);
  const h = await harness();
  for (const consent of [false, undefined, "true"]) {
    await h.render().submitForm({ ...values, acceptedPersonalDataConsent: consent });
  }
  await h.render().submitForm({ ...values, email: "invalid" });
  assert.equal(h.submitted.length, 0);
  assert.equal(h.resets, 0);
});

test("contact: valid consent sends directly and success requires the business response", async () => {
  const h = await harness();
  let finish;
  h.setBusiness(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = h.render().submitForm(values);
  assert.equal(h.submitted.length, 1);
  assert.equal(h.resets, 0);
  assert.equal(h.render().sent, false);
  assert.equal(h.submitted[0].acceptedPersonalDataConsent, true);
  finish({ sent: true });
  await pending;
  assert.equal(h.resets, 1);
  assert.equal(h.render().sent, true);
});

test("contact: repeated submit cannot duplicate the in-flight message", async () => {
  const h = await harness();
  let finish;
  h.setBusiness(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = h.render().submitForm(values);
  await h.render().submitForm({ ...values, email: "changed@example.test" });
  assert.equal(h.submitted.length, 1);
  assert.equal(h.submitted[0].email, values.email);
  finish({ sent: true });
  await pending;
});

test("contact: failed delivery preserves fields and permits retry", async () => {
  const h = await harness();
  h.setBusiness(async () => {
    throw new Error("upstream");
  });
  await h.render().submitForm(values);
  assert.equal(h.resets, 0);
  assert.equal(h.render().sent, false);
  h.setBusiness(async () => ({ sent: true }));
  await h.render().submitForm(values);
  assert.equal(h.submitted.length, 2);
  assert.equal(h.resets, 1);
  assert.equal(h.render().sent, true);
});

test("contact: another message clears the success state and form", async () => {
  const h = await harness();
  await h.render().submitForm(values);
  h.render().handleSendAnother();
  assert.equal(h.render().sent, false);
  assert.equal(h.resets, 2);
});

test("contact: raw delivery errors never reach the UI", async () => {
  const h = await harness();
  h.setError(new Error("token=secret"));
  assert.equal(h.render().submitError, "Не удалось отправить сообщение. Попробуйте ещё раз.");
});

test("contact: payload retains the actual checkbox and only the reply fields", () => {
  assert.deepEqual(buildContactMessagePayload({ ...values, name: " Анна ", order: " 123 " }), {
    acceptedPersonalDataConsent: true,
    name: "Анна",
    email: values.email,
    message: values.message,
    order: "123",
  });
});

test("contact: public transport keeps CSRF and request metadata without reading or forwarding credentials", async () => {
  const calls = [];
  const savedFetch = globalThis.fetch;
  const actions = evaluate(await read("shared/actions/contact-form/contact-form.actions.ts"), {
    "next/headers": { headers: async () => new Headers({ "x-real-ip": "127.0.0.99" }) },
    "@/shared/lib/api-security": {
      apiCsrfHeader: { "x-artmate-csrf": "1" },
      getForwardedIpHeaders: (headers) => ({ "x-real-ip": headers.get("x-real-ip") }),
    },
    "@/shared/lib/api-result": {
      ApiResult: {
        prepareApi: (call) => async () => ({
          toDTO: () => ({ data: { sent: true } }),
          result: await call(),
        }),
      },
    },
  });
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ sent: true }) };
  };
  try {
    await actions.submitContactMessage(values);
    assert.equal(calls[0].init.headers.cookie, undefined);
    assert.equal(calls[0].init.headers["x-artmate-csrf"], "1");
    assert.equal(calls[0].init.headers["x-real-ip"], "127.0.0.99");
    assert.equal(calls[0].init.cache, "no-store");
    assert.deepEqual(JSON.parse(calls[0].init.body), values);
  } finally {
    globalThis.fetch = savedFetch;
  }
});
