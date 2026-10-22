import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/auth/lib/auth-flow-coordinator.ts", import.meta.url),
  "utf8",
);
function load(source, mocks = {}) {
  const loaded = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  )(
    (name) => {
      assert.ok(name in mocks, name);
      return mocks[name];
    },
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
const mapper = load(
  await readFile(
    new URL("../src/features/auth/lib/to-consent-decision.ts", import.meta.url),
    "utf8",
  ),
);
const loaded = { exports: load(source, { "./to-consent-decision": mapper }) };
const { AuthFlowCoordinator } = loaded.exports;
const user = {
  id: "user-1",
  provider: "credentials",
  providerUserId: "user-1",
  email: "anna@example.com",
  roles: ["customer"],
};
const completed = { status: "COMPLETED", user };
const login = { status: "LOGIN_REQUIRED", nextStep: "login" };
const pending = (nextStep, extra = {}) => ({
  status: "PENDING",
  nextStep,
  flowId: "flow-1",
  expiresAt: "2100-01-01T00:00:00.000Z",
  ...extra,
});
const consents = () =>
  pending("consents", {
    operationKey: "server-operation",
    expectedStateRevision: 3,
    expectedAdvertisingVersion: 8,
    personalData: { revisionId: "pdn-v2" },
    emailAdvertising: { revisionId: "ads-v4" },
  });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
function setup(overrides = {}) {
  const calls = [];
  const ports = Object.fromEntries(
    [
      "start",
      "login",
      "requestCode",
      "confirmCode",
      "resend",
      "saveRegistration",
      "saveActivation",
      "saveProfile",
      "complete",
      "resume",
      "cancel",
      "recovery",
      "publishSession",
    ].map((name) => [
      name,
      async (input) => {
        calls.push([name, input]);
        return name === "start" ? login : name === "resume" ? completed : undefined;
      },
    ]),
  );
  Object.assign(ports, {
    now: () => 0,
    wait: async () => {},
    operationKey: () => "generated-operation",
    ...overrides,
  });
  return { coordinator: new AuthFlowCoordinator(ports), calls, ports };
}

// These execute the coordinator with controlled mutation results; no browser or real timer is needed.
test("same owner double click shares one Promise, payload and terminal callback", async () => {
  const gate = deferred();
  const { coordinator } = setup({ start: () => gate.promise });
  const owner = Symbol();
  const payload = { note: "captured" };
  let calls = 0;
  const promise = coordinator.request(
    owner,
    {},
    {
      onSuccess: (fresh, captured) => {
        assert.equal(fresh, user);
        assert.equal(captured, payload);
        calls++;
      },
    },
    payload,
  );
  assert.equal(
    coordinator.request(
      owner,
      {},
      { onSuccess: () => assert.fail("second callback") },
      { note: "other" },
    ),
    promise,
  );
  gate.resolve(completed);
  assert.deepEqual(await promise, { status: "success", user });
  assert.equal(calls, 1);
});

test("busy is delivered only to the competing owner", async () => {
  const { coordinator } = setup();
  let ownerErrors = 0;
  const first = coordinator.request(Symbol(), {}, { onError: () => ownerErrors++ }, undefined);
  await flush();
  let otherErrors = 0;
  assert.deepEqual(
    await coordinator.request(
      Symbol(),
      {},
      {
        onError: (failure, value) => {
          otherErrors++;
          assert.equal(failure.code, "busy");
          assert.equal(value, 7);
        },
      },
      7,
    ),
    { status: "error", error: { code: "busy" } },
  );
  assert.equal(ownerErrors, 0);
  assert.equal(otherErrors, 1);
  await coordinator.cancel();
  await first;
});

test("fresh session cache is published before callback and host releases before business work", async () => {
  const publication = deferred();
  const business = deferred();
  const events = [];
  const { coordinator } = setup({
    start: async () => completed,
    publishSession: async (fresh) => {
      events.push(fresh);
      await publication.promise;
    },
  });
  const owner = Symbol();
  const promise = coordinator.request(
    owner,
    {},
    {
      onSuccess: () => {
        events.push("callback");
        assert.equal(coordinator.isPending(owner), false);
        return business.promise;
      },
    },
    undefined,
  );
  await flush();
  assert.deepEqual(events, [user]);
  publication.resolve();
  await flush();
  assert.deepEqual(events, [user, "callback"]);
  assert.equal(coordinator.getSnapshot().step, "success");
  assert.equal(coordinator.getSnapshot().visible, false);
  business.resolve();
  await promise;
});

test("business callback rejection rejects Promise without authentication onError", async () => {
  const failure = new Error("business send failed");
  const { coordinator } = setup({ start: async () => completed });
  let errors = 0;
  const promise = coordinator.request(
    Symbol(),
    {},
    {
      onSuccess: () => {
        throw failure;
      },
      onError: () => errors++,
    },
    undefined,
  );
  await assert.rejects(promise, (error) => error === failure);
  assert.equal(errors, 0);
});

test("cancel settles immediately then drains old response and cancellation before another owner", async () => {
  const response = deferred();
  const cancellation = deferred();
  let succeeded = 0;
  let cancelled = 0;
  let cancelRequests = 0;
  const { coordinator } = setup({
    start: () => response.promise,
    cancel: async () => {
      cancelRequests++;
      await cancellation.promise;
    },
  });
  const promise = coordinator.request(
    Symbol(),
    {},
    { onSuccess: () => succeeded++, onError: () => cancelled++ },
    undefined,
  );
  const drain = coordinator.cancel();
  assert.equal((await promise).error.code, "cancelled");
  assert.equal(cancelled, 1);
  assert.equal(cancelRequests, 0);
  assert.equal((await coordinator.request(Symbol(), {}, {}, undefined)).error.code, "busy");
  response.resolve(completed);
  await flush();
  assert.equal(succeeded, 0);
  assert.equal(cancelRequests, 1);
  assert.equal((await coordinator.request(Symbol(), {}, {}, undefined)).error.code, "busy");
  cancellation.resolve();
  await drain;
  assert.equal(coordinator.getSnapshot().step, "closed");
});

test("unmount suppresses both callbacks and late success publication", async () => {
  const response = deferred();
  let callbacks = 0;
  let publications = 0;
  const { coordinator } = setup({
    start: () => response.promise,
    publishSession: async () => publications++,
  });
  const owner = Symbol();
  const promise = coordinator.request(
    owner,
    {},
    { onSuccess: () => callbacks++, onError: () => callbacks++ },
    undefined,
  );
  coordinator.releaseOwner(owner);
  assert.equal((await promise).error.code, "cancelled");
  response.resolve(completed);
  await flush();
  assert.equal(callbacks, 0);
  assert.equal(publications, 0);
});

test("password login goes directly to server consents without requesting an email code", async () => {
  const { coordinator, calls } = setup({ login: async () => consents() });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.login({ email: user.email, password: "secret-password" });
  assert.equal(coordinator.getSnapshot().step, "consents");
  assert.equal(
    calls.some(([name]) => name === "requestCode"),
    false,
  );
  assert.equal(JSON.stringify(coordinator.getSnapshot()).includes("secret-password"), false);
  await coordinator.cancel();
  await promise;
});

test("wrong password is correctable and does not notify terminal error", async () => {
  let failures = 0;
  const { coordinator } = setup({
    login: async () => {
      throw { status: 401 };
    },
  });
  const promise = coordinator.request(Symbol(), {}, { onError: () => failures++ }, undefined);
  await flush();
  await coordinator.login({ email: user.email, password: "wrong" });
  assert.equal(coordinator.getSnapshot().step, "login");
  assert.equal(coordinator.getSnapshot().error, "Проверьте почту и пароль.");
  assert.equal(failures, 0);
  await coordinator.cancel();
  await promise;
});

test("explicit password login cancels an unfinished identity before using the submitted account", async () => {
  const events = [];
  let previousFlow = true;
  const { coordinator, calls } = setup({
    cancel: async () => {
      events.push("cancel-A");
      previousFlow = false;
    },
    login: async (input) => {
      events.push("login-B");
      assert.equal(previousFlow, false);
      assert.equal(input.email, "account-b@example.test");
      return consents();
    },
    resume: async () => assert.fail("must not resume account A"),
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.login({ email: "account-b@example.test", password: "existing-password" });
  assert.deepEqual(events, ["cancel-A", "login-B"]);
  assert.equal(coordinator.getSnapshot().step, "consents");
  assert.equal(coordinator.getSnapshot().email, "account-b@example.test");
  assert.equal(
    calls.some(([name]) => name === "publishSession"),
    false,
  );
  await coordinator.cancel();
  await promise;
});

test("password login still works when no pending flow exists", async () => {
  const { coordinator } = setup({
    cancel: async () => {
      throw { status: 401 };
    },
    login: async () => consents(),
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.login({ email: user.email, password: "existing-password" });
  assert.equal(coordinator.getSnapshot().step, "consents");
  await coordinator.cancel();
  await promise;
});

for (const status of [409, 500]) {
  test(`password error ${status} never resumes or publishes an older account`, async () => {
    let callbacks = 0;
    const { coordinator, calls } = setup({
      login: async () => {
        throw { status };
      },
      resume: async () => assert.fail("must not resume an older account"),
    });
    const promise = coordinator.request(Symbol(), {}, { onSuccess: () => callbacks++ }, undefined);
    await flush();
    await coordinator.login({ email: "account-b@example.test", password: "existing-password" });
    assert.equal(coordinator.getSnapshot().step, "login");
    assert.equal(coordinator.getSnapshot().email, "account-b@example.test");
    assert.equal(coordinator.getSnapshot().canRetry, false);
    assert.equal(coordinator.getSnapshot().error, "Не удалось войти. Попробуйте ещё раз.");
    assert.equal(callbacks, 0);
    assert.equal(
      calls.some(([name]) => name === "publishSession"),
      false,
    );
    await coordinator.cancel();
    await promise;
  });
}

test("a failed cancellation does not send credentials or resume the old account", async () => {
  const { coordinator, calls } = setup({
    cancel: async () => {
      throw { status: 503 };
    },
    resume: async () => assert.fail("must not resume the old account"),
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.login({ email: user.email, password: "existing-password" });
  assert.equal(coordinator.getSnapshot().step, "login");
  assert.equal(coordinator.getSnapshot().pending, false);
  assert.equal(
    calls.some(([name]) => name === "login"),
    false,
  );
  await coordinator.cancel();
  await promise;
});

test("closing login while cancellation is pending never sends the password afterwards", async () => {
  const gate = deferred();
  let cancellations = 0;
  let callbacks = 0;
  const { coordinator, calls } = setup({
    cancel: async () => {
      if (++cancellations === 1) await gate.promise;
    },
  });
  const owner = Symbol();
  const promise = coordinator.request(
    owner,
    {},
    {
      onSuccess: () => callbacks++,
      onError: () => callbacks++,
    },
    undefined,
  );
  await flush();
  const loginAttempt = coordinator.login({ email: user.email, password: "existing-password" });
  coordinator.releaseOwner(owner);
  gate.resolve();
  await loginAttempt;
  await promise;
  await flush();
  assert.equal(
    calls.some(([name]) => name === "login"),
    false,
  );
  assert.equal(callbacks, 0);
  assert.equal(coordinator.getSnapshot().step, "closed");
});

test("registration confirms only current generation and uses stable credential operation key", async () => {
  const inputs = [];
  let tries = 0;
  const { coordinator } = setup({
    requestCode: async () => pending("code", { generation: 4 }),
    confirmCode: async (input) => {
      inputs.push(input);
      return pending("registration");
    },
    saveRegistration: async (input) => {
      inputs.push(input);
      if (++tries === 1) throw { status: 400 };
      return consents();
    },
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.showEmail();
  await coordinator.requestCode({ email: user.email });
  await coordinator.confirmCode({ code: "123456" });
  assert.deepEqual(inputs[0], { code: "123456", generation: 4 });
  const values = {
    name: "Анна",
    phone: "+79990000000",
    password: "private-password",
    passwordConfirm: "private-password",
  };
  await coordinator.saveRegistration(values);
  await coordinator.saveRegistration(values);
  assert.equal(inputs[1].operationKey, "generated-operation");
  assert.equal(inputs[2].operationKey, inputs[1].operationKey);
  assert.equal(coordinator.getSnapshot().step, "consents");
  assert.equal(JSON.stringify(coordinator.getSnapshot()).includes("private-password"), false);
  await coordinator.cancel();
  await promise;
});

test("unchecked advertising is an explicit false decision, not an implicit grant", async () => {
  let submitted;
  const { coordinator } = setup({
    start: async () => consents(),
    complete: async (input) => {
      submitted = input;
      return completed;
    },
  });
  const promise = coordinator.request(Symbol(), { source: "contact_form" }, {}, undefined);
  await flush();
  await coordinator.submitConsents({ personalData: true, advertising: false });
  assert.deepEqual(submitted, {
    operationKey: "server-operation",
    expectedStateRevision: 3,
    expectedAdvertisingVersion: 8,
    source: "contact_form",
    decisions: [
      { revisionId: "pdn-v2", accepted: true },
      { revisionId: "ads-v4", accepted: false },
    ],
  });
  assert.equal((await promise).status, "success");
});

test("required consent false keeps current form and never submits", async () => {
  const { coordinator, calls } = setup({ start: async () => consents() });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.submitConsents({ personalData: false, advertising: true });
  assert.equal(coordinator.getSnapshot().step, "consents");
  assert.equal(
    calls.some(([name]) => name === "complete"),
    false,
  );
  await coordinator.cancel();
  await promise;
});

test("lost completion response resumes the existing operation instead of re-sending consent", async () => {
  let writes = 0;
  let resumes = 0;
  const { coordinator } = setup({
    start: async () => consents(),
    complete: async () => {
      writes++;
      throw new Error("network response lost");
    },
    resume: async () => {
      resumes++;
      return completed;
    },
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.submitConsents({ personalData: true, advertising: true });
  assert.equal((await promise).status, "success");
  assert.equal(writes, 1);
  assert.equal(resumes, 1);
});

test("unknown outcome retry uses only resume and retains exact consent form", async () => {
  let resumes = 0;
  let writes = 0;
  const { coordinator } = setup({
    start: async () => consents(),
    complete: async () => {
      writes++;
      throw new Error("network");
    },
    resume: async () => {
      if (++resumes === 1) throw new Error("network");
      return completed;
    },
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.submitConsents({ personalData: true, advertising: true });
  assert.equal(coordinator.getSnapshot().canRetry, true);
  assert.equal(coordinator.getSnapshot().flow.operationKey, "server-operation");
  await coordinator.retry();
  await promise;
  assert.equal(writes, 1);
  assert.equal(resumes, 2);
});

test("completion polling is bounded and resumes the same flow", async () => {
  let polls = 0;
  let waits = 0;
  const { coordinator } = setup({
    start: async () => pending("completion", { operationId: "operation-1" }),
    resume: async () => {
      polls++;
      return pending("completion", { operationId: "operation-1" });
    },
    wait: async () => {
      waits++;
    },
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  for (let i = 0; i < 15; i++) await flush();
  assert.equal(polls, 30);
  assert.equal(waits, 30);
  assert.equal(coordinator.getSnapshot().pending, false);
  assert.equal(coordinator.getSnapshot().canRetry, true);
  await coordinator.cancel();
  await promise;
});

test("completion stops at expiry and reports a single terminal failure", async () => {
  let clock = 0;
  const { coordinator } = setup({
    start: async () => pending("completion", { expiresAt: new Date(100).toISOString() }),
    resume: async () => pending("completion", { expiresAt: new Date(100).toISOString() }),
    now: () => clock,
    wait: async () => {
      clock += 250;
    },
  });
  let errors = 0;
  const result = await coordinator.request(Symbol(), {}, { onError: () => errors++ }, undefined);
  assert.equal(result.error.code, "flow_expired");
  assert.equal(errors, 1);
});

test("unavailable readiness fails closed without an automatic completion loop", async () => {
  let resumes = 0;
  const { coordinator } = setup({
    start: async () => pending("preparing", { emailVerified: true }),
    resume: async () => {
      resumes++;
      return pending("preparing", { emailVerified: true });
    },
  });
  const result = await coordinator.request(Symbol(), {}, {}, undefined);
  assert.equal(result.error.code, "state_unavailable");
  assert.equal(resumes, 1);
});

test("server account rejection is terminal and never publishes a stale cached user", async () => {
  const { coordinator, calls } = setup({
    start: async () => ({ status: "REJECTED", errorCode: "ACCOUNT_CHANGED" }),
  });
  const result = await coordinator.request(Symbol(), {}, {}, undefined);
  assert.equal(result.error.code, "authentication_failed");
  assert.equal(
    calls.some(([name]) => name === "publishSession"),
    false,
  );
});

test("a later explicit onAuth checks the server again after advertising was skipped", async () => {
  let starts = 0;
  const { coordinator } = setup({
    start: async () => {
      starts++;
      return consents();
    },
    complete: async () => completed,
  });
  const owner = Symbol();
  const first = coordinator.request(owner, {}, {}, undefined);
  await flush();
  await coordinator.submitConsents({ personalData: true, advertising: false });
  await first;
  const second = coordinator.request(owner, {}, {}, undefined);
  await flush();
  assert.equal(starts, 2);
  assert.equal(coordinator.getSnapshot().step, "consents");
  await coordinator.cancel();
  await second;
});

test("unavailable Yandex adapter keeps login recoverable without a legacy endpoint", async () => {
  const { coordinator, calls } = setup();
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.startYandex();
  assert.equal(coordinator.getSnapshot().step, "login");
  assert.match(coordinator.getSnapshot().error, /Яндекс/);
  assert.equal(calls.filter(([name]) => name === "start").length, 1);
  await coordinator.cancel();
  await promise;
});

test("back waits for a code response and cancel before exposing another entry", async () => {
  const response = deferred();
  const cancellation = deferred();
  let cancellations = 0;
  const { coordinator } = setup({
    requestCode: () => response.promise,
    cancel: async () => {
      if (++cancellations === 2) await cancellation.promise;
    },
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.showEmail();
  const submitted = coordinator.requestCode({ email: user.email });
  const back = coordinator.showLogin();
  response.resolve(pending("code", { generation: 1 }));
  await submitted;
  await flush();
  assert.equal(coordinator.getSnapshot().pending, true);
  assert.notEqual(coordinator.getSnapshot().step, "code");
  cancellation.resolve();
  await back;
  assert.equal(coordinator.getSnapshot().step, "login");
  await coordinator.cancel();
  await promise;
});

test("ready password flow asks server completion once without an extra Continue", async () => {
  let resumes = 0;
  const { coordinator } = setup({
    login: async () => pending("preparing", { emailVerified: true }),
    resume: async () => {
      resumes++;
      return completed;
    },
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.login({ email: user.email, password: "password" });
  assert.equal((await promise).status, "success");
  assert.equal(resumes, 1);
});

test("anonymous signup entry treats missing pending cancellation as already cancelled", async () => {
  const { coordinator } = setup({
    cancel: async () => {
      throw { status: 401 };
    },
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.showEmail();
  assert.equal(coordinator.getSnapshot().step, "email");
  assert.equal(coordinator.getSnapshot().error, null);
  await coordinator.cancel();
  await promise;
});

test("ready existing session remains invisible while fresh publication is pending", async () => {
  const gate = deferred();
  const { coordinator } = setup({
    start: async () => completed,
    publishSession: () => gate.promise,
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  assert.equal(coordinator.getSnapshot().visible, false);
  await flush();
  assert.equal(coordinator.getSnapshot().visible, false);
  gate.resolve();
  await promise;
  assert.equal(coordinator.getSnapshot().visible, false);
});

test("activation keeps its server identity through password, missing profile and consents", async () => {
  let passwordInput;
  let profileInput;
  const { coordinator, calls } = setup({
    start: async () => pending("activation"),
    saveActivation: async (input) => {
      passwordInput = input;
      return pending("profile", { name: "Анна", phone: null, missingFields: ["phone"] });
    },
    saveProfile: async (input) => {
      profileInput = input;
      return consents();
    },
    complete: async () => completed,
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.saveActivation({ password: "secret123", passwordConfirm: "secret123" });
  assert.equal(passwordInput.operationKey, "generated-operation");
  assert.equal(coordinator.getSnapshot().step, "profile");
  await coordinator.saveProfile({ name: "Анна", phone: "+79990000000" });
  assert.deepEqual(profileInput, { name: "Анна", phone: "+79990000000" });
  await coordinator.submitConsents({ personalData: true, advertising: false });
  assert.equal((await promise).user.id, user.id);
  assert.equal(
    calls.some(([name]) => name === "requestCode"),
    false,
  );
});

test("cancel during fresh-cache publication suppresses business continuation", async () => {
  const publication = deferred();
  let called = 0;
  const { coordinator } = setup({
    start: async () => completed,
    publishSession: () => publication.promise,
  });
  const promise = coordinator.request(Symbol(), {}, { onSuccess: () => called++ }, undefined);
  await flush();
  const drain = coordinator.cancel();
  assert.equal((await promise).error.code, "cancelled");
  publication.resolve();
  await drain;
  assert.equal(called, 0);
});

test("double consent submit while server is pending writes one decision", async () => {
  const response = deferred();
  let writes = 0;
  const { coordinator } = setup({
    start: async () => consents(),
    complete: async () => {
      writes++;
      return response.promise;
    },
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  const submission = coordinator.submitConsents({ personalData: true, advertising: true });
  await coordinator.submitConsents({ personalData: true, advertising: true });
  assert.equal(writes, 1);
  response.resolve(completed);
  await submission;
  await promise;
});

test("recovery result keeps owner and never treats an email delivery as authentication", async () => {
  const { coordinator, calls } = setup();
  const owner = Symbol();
  let callbacks = 0;
  const promise = coordinator.request(owner, {}, { onSuccess: () => callbacks++ }, undefined);
  await flush();
  await coordinator.showRecovery();
  await coordinator.requestRecovery({ email: user.email });
  assert.equal(coordinator.getSnapshot().step, "recovery");
  assert.equal(coordinator.getSnapshot().recoverySent, true);
  assert.equal(coordinator.isPending(owner), true);
  assert.equal(callbacks, 0);
  assert.equal(
    calls.some(([name]) => name === "publishSession"),
    false,
  );
  await coordinator.cancel();
  await promise;
});

test("unknown final decision switches to recovery and changed re-submit can only resume", async () => {
  let writes = 0;
  let resumes = 0;
  const { coordinator } = setup({
    start: async () => consents(),
    complete: async () => {
      writes++;
      throw new Error("response lost");
    },
    resume: async () => {
      if (++resumes === 1) throw new Error("network unavailable");
      return completed;
    },
  });
  const owner = Symbol();
  let callbacks = 0;
  const promise = coordinator.request(owner, {}, { onSuccess: () => callbacks++ }, undefined);
  await flush();
  await coordinator.submitConsents({ personalData: true, advertising: true });
  assert.equal(coordinator.getSnapshot().step, "completion");
  assert.equal(coordinator.getSnapshot().visible, true);
  assert.equal(coordinator.getSnapshot().canRetry, true);
  assert.equal(coordinator.request(owner, {}, {}, undefined), promise);
  await coordinator.submitConsents({ personalData: true, advertising: false });
  assert.equal(writes, 1);
  assert.equal(resumes, 2);
  assert.equal((await promise).status, "success");
  assert.equal(callbacks, 1);
});

test("activation route exchanges its link before common profile and consent steps, without session start", async () => {
  let entry;
  const { coordinator, calls } = setup({
    exchangeActivation: async (input) => {
      entry = input;
      return pending("activation");
    },
    saveActivation: async () => consents(),
    complete: async () => completed,
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined, {
    type: "activation",
    token: "link-secret",
  });
  await flush();
  assert.deepEqual(entry, { token: "link-secret" });
  assert.equal(
    calls.some(([name]) => name === "start"),
    false,
  );
  assert.equal(coordinator.getSnapshot().step, "activation");
  assert.equal(JSON.stringify(coordinator.getSnapshot()).includes("link-secret"), false);
  await coordinator.saveActivation({
    password: "valid-password",
    passwordConfirm: "valid-password",
  });
  await coordinator.submitConsents({ personalData: true, advertising: false });
  assert.equal((await promise).status, "success");
});

test("invalid activation link settles its owner instead of leaving an invisible loading state", async () => {
  const { coordinator } = setup({
    exchangeActivation: async () => {
      throw { status: 400 };
    },
  });
  const result = await coordinator.request(Symbol(), {}, {}, undefined, {
    type: "activation",
    token: "expired",
  });
  assert.equal(result.error.code, "flow_expired");
  assert.equal(coordinator.getSnapshot().step, "closed");
});

test("recovery route bypasses session entry and starts the shared recovery step", async () => {
  const { coordinator, calls } = setup();
  const promise = coordinator.request(Symbol(), {}, {}, undefined, { type: "recovery" });
  await flush();
  assert.equal(coordinator.getSnapshot().step, "recovery");
  assert.equal(
    calls.some(([name]) => name === "start"),
    false,
  );
  await coordinator.requestRecovery({ email: "anna@example.com" });
  assert.equal(coordinator.getSnapshot().recoverySent, true);
  await coordinator.cancel();
  await promise;
});

test("resume route reads the same server flow and publishes session before callback", async () => {
  const { coordinator, calls } = setup();
  let count = 0;
  const promise = coordinator.request(
    Symbol(),
    {},
    {
      onSuccess: () => {
        count++;
        assert.equal(calls.at(-1)[0], "publishSession");
      },
    },
    undefined,
    { type: "resume" },
  );
  assert.equal((await promise).status, "success");
  assert.equal(count, 1);
  assert.equal(calls.filter(([name]) => name === "resume").length, 1);
  assert.equal(
    calls.some(([name]) => name === "start"),
    false,
  );
});

test("Yandex uses its bound server state and common consents before its owner's callback", async () => {
  const { coordinator } = setup({
    yandex: async () => consents(),
    complete: async () => completed,
  });
  let count = 0;
  const promise = coordinator.request(
    Symbol(),
    {},
    {
      onSuccess: () => {
        count++;
      },
    },
    undefined,
  );
  await flush();
  await coordinator.startYandex();
  assert.equal(coordinator.getSnapshot().step, "consents");
  assert.equal(count, 0);
  await coordinator.submitConsents({ personalData: true, advertising: true });
  assert.equal((await promise).status, "success");
  assert.equal(count, 1);
});

test("cancel closes the provider and suppresses its late result before another owner starts", async () => {
  const result = deferred();
  let closed = 0;
  let count = 0;
  const { coordinator } = setup({
    yandex: () => result.promise,
    cancelProvider: () => {
      closed++;
    },
  });
  const promise = coordinator.request(
    Symbol(),
    {},
    {
      onSuccess: () => {
        count++;
      },
    },
    undefined,
  );
  await flush();
  void coordinator.startYandex();
  const cancelling = coordinator.cancel();
  assert.equal((await promise).error.code, "cancelled");
  assert.equal(closed, 1);
  result.resolve(completed);
  await cancelling;
  assert.equal(count, 0);
});

test("email registration telemetry fires once after confirmed session, never on its draft", async () => {
  let events = 0;
  const { coordinator } = setup({
    requestCode: async () => pending("code", { generation: 1 }),
    confirmCode: async () => pending("registration"),
    saveRegistration: async () => consents(),
    complete: async () => completed,
    registrationCompleted: () => {
      events++;
    },
  });
  const promise = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  await coordinator.showEmail();
  await coordinator.requestCode({ email: "anna@example.com" });
  await coordinator.confirmCode({ code: "123456" });
  await coordinator.saveRegistration({
    name: "Анна",
    phone: "+79991234567",
    password: "valid-password",
    passwordConfirm: "valid-password",
  });
  assert.equal(events, 0);
  await coordinator.submitConsents({ personalData: true, advertising: false });
  assert.equal((await promise).status, "success");
  assert.equal(events, 1);
  await coordinator.submitConsents({ personalData: true, advertising: false });
  assert.equal(events, 1);
});

test("password login and Yandex continuation do not create email registration telemetry", async () => {
  for (const provider of [false, true]) {
    let events = 0;
    const { coordinator } = setup({
      login: async () => completed,
      yandex: async () => completed,
      registrationCompleted: () => {
        events++;
      },
    });
    const promise = coordinator.request(Symbol(), {}, {}, undefined);
    await flush();
    if (provider) await coordinator.startYandex();
    else await coordinator.login({ email: "anna@example.com", password: "valid-password" });
    assert.equal((await promise).status, "success");
    assert.equal(events, 0);
  }
});

test("inline auth keeps initialization failure inside a usable login form and permits a fresh attempt", async () => {
  let attempts = 0;
  let failures = 0;
  const { coordinator, calls } = setup({
    login: async () => (++attempts === 1 ? pending("preparing") : consents()),
    resume: async () => pending("preparing"),
    complete: async () => completed,
  });
  const outcome = coordinator.request(
    Symbol(),
    { presentation: "inline" },
    {
      onError: () => failures++,
    },
    undefined,
  );
  await flush();
  await coordinator.login({ email: user.email, password: "test-password" });
  await flush();
  assert.equal(coordinator.getSnapshot().step, "login");
  assert.equal(coordinator.getSnapshot().pending, false);
  assert.equal(coordinator.getSnapshot().email, user.email);
  assert.equal(coordinator.getSnapshot().error, "Не удалось войти. Попробуйте ещё раз.");
  assert.equal(failures, 0);
  assert.equal(
    calls.some(([name]) => name === "publishSession"),
    false,
  );
  await coordinator.login({ email: user.email, password: "test-password" });
  assert.equal(coordinator.getSnapshot().step, "consents");
  await coordinator.submitConsents({ personalData: true, advertising: false });
  assert.equal((await outcome).status, "success");
  assert.equal(failures, 0);
});

test("inline expired continuation returns to the standard login form without a session", async () => {
  const { coordinator, calls } = setup({
    start: async () => {
      throw { status: 410 };
    },
  });
  const outcome = coordinator.request(Symbol(), { presentation: "inline" }, {}, undefined);
  await flush();
  assert.equal(coordinator.getSnapshot().step, "login");
  assert.equal(coordinator.getSnapshot().pending, false);
  assert.equal(coordinator.getSnapshot().error, "Время входа истекло. Войдите заново.");
  assert.equal(
    calls.some(([name]) => name === "publishSession"),
    false,
  );
  await coordinator.cancel();
  assert.equal((await outcome).error.code, "cancelled");
});

test("logout cancellation discards the previous identity and email even after success", async () => {
  const { coordinator, ports } = setup({ start: async () => completed });
  await coordinator.request(Symbol(), { initialEmail: user.email }, {}, undefined);
  assert.equal(coordinator.getSnapshot().user.id, user.id);
  await coordinator.cancel();
  assert.equal(coordinator.getSnapshot().step, "closed");
  assert.equal(coordinator.getSnapshot().email, "");
  assert.equal(coordinator.getSnapshot().user, undefined);
  ports.start = async () => login;
  const next = coordinator.request(Symbol(), {}, {}, undefined);
  await flush();
  assert.equal(coordinator.getSnapshot().step, "login");
  assert.equal(coordinator.getSnapshot().email, "");
  await coordinator.cancel();
  await next;
});
