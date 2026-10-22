import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function load(path, mocks = {}) {
  const source = await readFile(
    new URL(`../src/features/wholesale-application/${path}`, import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

const application = {
  company: "  Студия цвета  ",
  email: "  studio@example.com  ",
  task: "  Нужны 20 альбомов для занятий.\nДоставка в ноябре.  ",
  acceptedPersonalDataConsent: true,
};

test("application validates all three fields and requires explicit consent", async () => {
  const { wholesaleApplicationSchema: schema, wholesaleApplicationDefaults: defaults } =
    await load("lib/form-values.ts");
  const result = schema.parse(application);
  assert.equal(result.company, "Студия цвета");
  assert.equal(result.email, "studio@example.com");
  assert.equal(result.task, "Нужны 20 альбомов для занятий.\nДоставка в ноябре.");
  assert.equal(schema.safeParse(defaults).success, false);
  for (const invalid of [
    { company: "  " },
    { email: "studio@" },
    { task: "\n " },
    { acceptedPersonalDataConsent: false },
  ]) {
    assert.equal(schema.safeParse({ ...application, ...invalid }).success, false);
  }
});

test("application limits fit the contacts API and preserve a full length task", async () => {
  const { wholesaleApplicationSchema: schema } = await load("lib/form-values.ts");
  const { buildWholesaleApplicationPayload: build } = await load("lib/application-payload.ts");
  const values = schema.parse({ ...application, company: "А".repeat(80), task: "Б".repeat(2000) });
  assert.equal(build(values).message.length, 2000);
  for (const invalid of [
    { company: "А".repeat(81) },
    { task: "Б".repeat(2001) },
    { email: `${"a".repeat(250)}@example.com` },
  ]) {
    assert.equal(schema.safeParse({ ...application, ...invalid }).success, false);
  }
});

test("application reaches the existing contact channel with a wholesale subject", async () => {
  const { buildWholesaleApplicationPayload: build } = await load("lib/application-payload.ts");
  assert.deepEqual(build(application), {
    name: "Студия цвета",
    email: "studio@example.com",
    message: "Нужны 20 альбомов для занятий.\nДоставка в ноябре.",
    topic: "Оптовый заказ",
    acceptedPersonalDataConsent: true,
  });
});

test("mutation confirms success only when the server reports sent", async () => {
  const mapper = await load("lib/application-payload.ts");
  for (const response of [
    { data: { sent: true } },
    { data: { sent: false } },
    { data: undefined },
    { error: new Error("Unavailable") },
  ]) {
    const requests = [];
    const { useSubmitApplication: createMutation } = await load("model/use-submit-application.ts", {
      "../lib/application-payload": mapper,
      "@tanstack/react-query": { useMutation: ({ mutationFn }) => ({ mutateAsync: mutationFn }) },
      "@/shared/actions/contact-form": {
        submitContactMessage: async (payload) => {
          requests.push(payload);
          return response;
        },
      },
      "@/shared/lib/api-result": {
        ApiResult: {
          fromDTO: (dto) => ({
            unwrap: () => {
              if (dto.error) throw dto.error;
              return dto.data;
            },
          }),
        },
      },
    });
    const { submitApplication } = createMutation();
    if (response.data?.sent) assert.deepEqual(await submitApplication(application), { sent: true });
    else await assert.rejects(() => submitApplication(application));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].topic, "Оптовый заказ");
  }
});

function find(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  const children = Array.isArray(node) ? node : node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

async function formHarness({ fail = false, pending = false } = {}) {
  const values = await load("lib/form-values.ts");
  const calls = { reset: 0, submitted: 0, registered: [] };
  let sent = false;
  const jsx = (type, props) => ({ type, props });
  const { WholesaleApplicationForm } = await load("ui/application-form.tsx", {
    "../lib/form-values": values,
    "../model/use-submit-application": {
      useSubmitApplication: () => ({
        isPending: pending,
        error: fail ? new Error("Internal error") : null,
        reset() {},
        submitApplication: async () => {
          calls.submitted++;
          if (fail) throw new Error("Internal error");
        },
      }),
    },
    "@/shared/constants": { routes: { contacts: "/contacts" } },
    "@/shared/ui": {
      Button: "Button",
      Input: "Input",
      Label: "Label",
      PersonalDataConsentCheckbox: "Consent",
      Textarea: "Textarea",
    },
    react: {
      useState: () => [
        sent,
        (value) => {
          sent = value;
        },
      ],
      useId: () => "test-form",
      useRef: () => ({ current: null }),
      useEffect() {},
    },
    "react-hook-form": {
      useForm: () => ({
        register: (name) => {
          calls.registered.push(name);
          return { name };
        },
        formState: { errors: {} },
        reset: () => {
          calls.reset++;
        },
        handleSubmit: (callback) => () => callback(application),
      }),
    },
    "@hookform/resolvers/zod": { zodResolver: (schema) => schema },
    "lucide-react": { ArrowUpRight: "Arrow", Check: "Check", LoaderCircle: "Loader" },
    "react/jsx-runtime": { jsx, jsxs: jsx },
  });
  return { calls, render: WholesaleApplicationForm, isSent: () => sent };
}

test("form has three business fields, blocks pending submits and resets only after success", async () => {
  const harness = await formHarness();
  const tree = harness.render();
  assert.deepEqual(harness.calls.registered, [
    "company",
    "email",
    "task",
    "acceptedPersonalDataConsent",
  ]);
  await find(tree, (node) => node.type === "form").props.onSubmit();
  assert.equal(harness.calls.submitted, 1);
  assert.equal(harness.calls.reset, 1);
  assert.equal(harness.isSent(), true);
  assert.equal(
    find(harness.render(), (node) => node.type === "form"),
    undefined,
  );

  const pending = await formHarness({ pending: true });
  assert.equal(
    find(pending.render(), (node) => node.type === "Button" && node.props.type === "submit").props
      .disabled,
    true,
  );
});

test("failed submission keeps form values and exposes a readable retry message", async () => {
  const harness = await formHarness({ fail: true });
  const tree = harness.render();
  await find(tree, (node) => node.type === "form").props.onSubmit();
  assert.equal(harness.isSent(), false);
  assert.equal(harness.calls.reset, 0);
  const alert = find(tree, (node) => node.props?.role === "alert");
  assert.ok(alert);
  assert.doesNotMatch(JSON.stringify(alert), /Internal error/);
});
