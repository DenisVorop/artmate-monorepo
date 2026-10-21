import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { QueryClient, MutationObserver } = require("@tanstack/react-query");
const cases = [
  [
    "use-finish-yandex-flow",
    "useFinishYandexFlow",
    "finishYandexFlow",
    { state: "private-oauth-state", code: "private-oauth-code" },
    false,
  ],
  [
    "use-exchange-order-activation",
    "useExchangeOrderActivation",
    "exchangeOrderActivation",
    { token: "private-activation-link" },
  ],
  [
    "use-confirm-recovery-password",
    "useConfirmRecoveryPassword",
    "confirmRecoveryPassword",
    {
      token: "private-reset-link",
      password: "private-password",
      passwordConfirm: "private-password",
    },
  ],
  [
    "use-start-password-flow",
    "useStartPasswordFlow",
    "startPasswordFlow",
    { email: "anna@example.com", password: "private-password" },
  ],
  [
    "use-confirm-registration-code",
    "useConfirmRegistrationCode",
    "confirmRegistrationCode",
    { code: "123456", generation: 4 },
  ],
  [
    "use-save-registration-draft",
    "useSaveRegistrationDraft",
    "saveRegistrationDraft",
    {
      name: "Анна",
      phone: "+79990000000",
      password: "private-password",
      passwordConfirm: "private-password",
      operationKey: "operation-1",
    },
  ],
  [
    "use-save-activation-password",
    "useSaveActivationPassword",
    "saveActivationPassword",
    {
      password: "private-password",
      passwordConfirm: "private-password",
      operationKey: "operation-1",
    },
  ],
];

for (const [file, hookName, actionName, input, callbacks = true] of cases) {
  const source = await readFile(
    new URL(`../src/features/auth/model/${file}.ts`, import.meta.url),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  for (const succeeds of [true, false]) {
    test(`${hookName} keeps secrets out of real MutationCache while pending and after ${succeeds ? "success" : "error"} while mounted`, async () => {
      const client = new QueryClient();
      const failure = new Error("request failed");
      const result = { status: "PENDING", nextStep: "consents" };
      let finish;
      const gate = new Promise((resolve) => {
        finish = resolve;
      });
      let observer;
      let unsubscribe;
      let successCallbacks = 0;
      let errorCallbacks = 0;
      const mocks = {
        react: { useRef: (value) => ({ current: value }) },
        "@tanstack/react-query": {
          useMutation: (options) => {
            assert.equal(options.gcTime, 0);
            observer = new MutationObserver(client, options);
            // A mounted global provider keeps the observer subscribed across requests.
            unsubscribe = observer.subscribe(() => {});
            return {
              mutateAsync: (variables) => observer.mutate(variables),
              reset: () => observer.reset(),
              isPending: false,
            };
          },
        },
        "@/shared/actions/auth": {
          prepareAuthContinuation: async () => ({ status: "READY" }),
          [actionName]: async (variables) => {
            assert.deepEqual(variables, input);
            await gate;
            if (!succeeds) throw failure;
            return result;
          },
        },
        "@/shared/lib/api-result": {
          ApiResult: { fromDTO: (data) => ({ unwrap: () => data }) },
        },
        "../lib/flow-error": { FlowError: { from: (error) => error } },
      };
      const loaded = { exports: {} };
      new Function("require", "module", "exports", js)(
        (name) => {
          assert.ok(name in mocks, name);
          return mocks[name];
        },
        loaded,
        loaded.exports,
      );
      try {
        const hook = loaded.exports[hookName]({
          onSuccess: (value) => {
            assert.equal(value, result);
            successCallbacks++;
          },
          onError: (error) => {
            assert.equal(error, failure);
            errorCallbacks++;
          },
        });
        assert.equal("mutate" in hook, false);
        const pending = hook.mutateAsync(input);
        assert.equal(
          client.getMutationCache().getAll()[0].state.variables,
          undefined,
        );
        const serialized = JSON.stringify(
          client
            .getMutationCache()
            .getAll()
            .map((mutation) => mutation.state),
        );
        for (const value of Object.values(input)) {
          if (typeof value === "string")
            assert.equal(serialized.includes(value), false);
        }
        await assert.rejects(hook.mutateAsync(input), /request is in progress/);
        finish();
        if (succeeds) assert.equal(await pending, result);
        else await assert.rejects(pending, (error) => error === failure);
        assert.equal(observer.getCurrentResult().variables, undefined);
        // gcTime:0 removes the detached mutation on the next timer turn, even though
        // the provider's observer remains mounted and subscribed.
        await setTimeout(10);
        assert.equal(client.getMutationCache().getAll().length, 0);
        assert.equal(successCallbacks, callbacks && succeeds ? 1 : 0);
        assert.equal(errorCallbacks, callbacks && !succeeds ? 1 : 0);
      } finally {
        unsubscribe?.();
        client.clear();
      }
    });
  }
}
