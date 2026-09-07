import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readSource(path) {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  } catch {
    return "";
  }
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
  const localRequire = (specifier) =>
    Object.hasOwn(mocks, specifier) ? mocks[specifier] : require(specifier);

  new Function("require", "module", "exports", output)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );

  return loadedModule.exports;
}

async function loadSharedAnalytics() {
  const types = evaluateTypeScript(await readSource("src/shared/lib/analytics/types.ts"));
  const product = evaluateTypeScript(await readSource("src/shared/lib/analytics/product.ts"));
  const dedupe = evaluateTypeScript(await readSource("src/shared/lib/analytics/dedupe.ts"));
  const sanitizer = evaluateTypeScript(
    await readSource("src/shared/lib/analytics/sanitize-analytics-url.ts"),
  );
  const factory = evaluateTypeScript(await readSource("src/shared/lib/analytics/create-analytics.ts"), {
    "./dedupe": dedupe,
    "./product": product,
    "./sanitize-analytics-url": sanitizer,
    "./types": types,
  });

  return { ...types, ...factory };
}

test("recovery and activation public APIs expose only their route components", async () => {
  const [recoveryIndex, activationIndex] = await Promise.all([
    readSource("src/features/account-recovery/index.ts"),
    readSource("src/features/order-activation/index.ts"),
  ]);

  assert.equal(
    recoveryIndex.trim(),
    'export { AccountRecovery } from "./ui/recovery-form";',
  );
  assert.equal(
    activationIndex.trim(),
    'export { OrderActivation } from "./ui/activation-form";',
  );
});

test("recovery and activation schemas validate inputs and map only API fields", async () => {
  const [recoverySource, activationSource] = await Promise.all([
    readSource("src/features/account-recovery/lib/form.ts"),
    readSource("src/features/order-activation/lib/form.ts"),
  ]);
  assert.notEqual(recoverySource, "");
  assert.notEqual(activationSource, "");

  const recovery = evaluateTypeScript(recoverySource);
  const activation = evaluateTypeScript(activationSource);

  assert.equal(
    recovery.recoveryFormSchema.safeParse({
      email: "guest@example.com",
      acceptedPersonalDataConsent: false,
    }).success,
    false,
  );
  assert.deepEqual(
    recovery.toRecoveryInput({
      email: " guest@example.com ",
      acceptedPersonalDataConsent: true,
    }),
    { email: "guest@example.com", acceptedPersonalDataConsent: true },
  );
  assert.equal(
    activation.orderActivationFormSchema.safeParse({
      password: "password-1",
      passwordConfirm: "different",
    }).success,
    false,
  );
  assert.deepEqual(
    activation.toOrderActivationInput(
      { password: "password-1", passwordConfirm: "password-1" },
      "activation-token",
    ),
    { password: "password-1", token: "activation-token" },
  );
});

test("recovery and activation forms use RHF with Zod and keep routes thin", async () => {
  const [recoveryForm, activationForm, recoveryRoute, activationRoute, routes] = await Promise.all([
    readSource("src/features/account-recovery/ui/recovery-form.tsx"),
    readSource("src/features/order-activation/ui/activation-form.tsx"),
    readSource("app/auth/recovery/page.tsx"),
    readSource("app/auth/activate-order/page.tsx"),
    readSource("src/shared/constants/routes.ts"),
  ]);

  for (const form of [recoveryForm, activationForm]) {
    assert.match(form, /useForm/u);
    assert.match(form, /zodResolver/u);
  }
  assert.match(recoveryForm, /acceptedPersonalDataConsent/u);
  assert.match(recoveryRoute, /AccountRecovery/u);
  assert.doesNotMatch(recoveryRoute, /useForm|useMutation|fetch\(/u);
  assert.match(activationRoute, /OrderActivation/u);
  assert.doesNotMatch(activationRoute, /useForm|useMutation|fetch\(/u);
  assert.match(routes, /authRecovery:\s*["']\/auth\/recovery["']/u);
  assert.match(routes, /authOrderActivation:\s*["']\/auth\/activate-order["']/u);
});

test("recovery request is generic and activation errors share one recovery path", async () => {
  const [recoveryForm, activationForm] = await Promise.all([
    readSource("src/features/account-recovery/ui/recovery-form.tsx"),
    readSource("src/features/order-activation/ui/activation-form.tsx"),
  ]);

  assert.match(recoveryForm, /Если аккаунт связан с этим email/u);
  assert.doesNotMatch(recoveryForm, /аккаунт (?:найден|не найден)|пользователь (?:найден|не найден)/ui);
  assert.match(activationForm, /Ссылка недействительна или истекла/u);
  assert.match(activationForm, /routes\.authRecovery/u);
  assert.doesNotMatch(activationForm, /["'](?:expired|consumed|invalid|unknown)["']/ui);
});

test("activation preflight state classification distinguishes invalid links from temporary failures", async () => {
  const stateSource = await readSource("src/features/order-activation/lib/activation-state.ts");
  assert.notEqual(stateSource, "", "pure activation state helper is missing");
  const { classifyActivationFailure, getActivationViewState } = evaluateTypeScript(stateSource);

  assert.equal(classifyActivationFailure({ status: 400 }), "invalid");
  assert.equal(classifyActivationFailure({ status: 404 }), "invalid");
  assert.equal(classifyActivationFailure({ status: 410 }), "invalid");
  assert.equal(classifyActivationFailure({ status: 500 }), "temporary");
  assert.equal(classifyActivationFailure({}), "temporary");

  assert.equal(getActivationViewState({ hasToken: true, preflight: "pending" }), "loading");
  assert.equal(getActivationViewState({ hasToken: true, preflight: "valid" }), "form");
  assert.equal(getActivationViewState({ hasToken: true, preflight: "invalid" }), "invalid");
  assert.equal(getActivationViewState({ hasToken: false, preflight: "idle" }), "invalid");
  assert.equal(getActivationViewState({ hasToken: true, preflight: "temporary" }), "temporary");
  assert.equal(
    getActivationViewState({
      confirmFailure: "invalid",
      hasToken: true,
      preflight: "valid",
    }),
    "invalid",
  );
  assert.equal(
    getActivationViewState({
      confirmFailure: "temporary",
      hasToken: true,
      preflight: "valid",
    }),
    "form",
  );
});

test("activation validation rechecks stale links and hides the form during refetch", async () => {
  const [activationForm, activationModel] = await Promise.all([
    readSource("src/features/order-activation/ui/activation-form.tsx"),
    readSource("src/features/order-activation/model/use-validate-activation.ts"),
  ]);

  assert.match(activationModel, /staleTime:\s*0/u);
  assert.doesNotMatch(activationModel, /staleTime:\s*Infinity/u);
  assert.match(activationModel, /isFetching/u);
  assert.match(activationForm, /validation\.isFetching/u);
});

test("activation confirmation state and success effects are scoped to the current token", async () => {
  const [stateSource, activationForm, activationMutation] = await Promise.all([
    readSource("src/features/order-activation/lib/activation-state.ts"),
    readSource("src/features/order-activation/ui/activation-form.tsx"),
    readSource("src/features/order-activation/model/use-confirm-activation.ts"),
  ]);
  const { isCurrentActivationToken } = evaluateTypeScript(stateSource);

  assert.equal(isCurrentActivationToken("token-a", "token-a"), true);
  assert.equal(isCurrentActivationToken("token-a", "token-b"), false);
  assert.equal(isCurrentActivationToken(undefined, "token-b"), false);
  assert.match(activationForm, /useConfirmActivation\(normalizedToken\)/u);
  assert.match(activationMutation, /currentTokenRef/u);
  assert.match(
    activationMutation,
    /isCurrentActivationToken\(input\.token,\s*currentTokenRef\.current\)/u,
  );
  assert.match(activationMutation, /isPending:\s*isCurrentMutation\s*&&\s*isPending/u);
  assert.match(activationMutation, /error:\s*isCurrentMutation\s*\?\s*error\s*:\s*undefined/u);

  const successBody = activationMutation.match(
    /onSuccess:\s*\(session,\s*input\)\s*=>\s*\{(?<body>[\s\S]*?)\n\s*\},/u,
  )?.groups?.body;
  assert.ok(successBody, "activation success callback is missing token scope");
  assert.ok(
    successBody.indexOf("isCurrentActivationToken") < successBody.indexOf("setQueryData"),
    "token scope must be checked before session, analytics and redirect effects",
  );
});

test("activation validates before the form and renders distinct loading, invalid and temporary states", async () => {
  const [activationForm, activationMutation, activationModel, actions, actionIndex, authTypes] =
    await Promise.all([
      readSource("src/features/order-activation/ui/activation-form.tsx"),
      readSource("src/features/order-activation/model/use-confirm-activation.ts"),
      readSource("src/features/order-activation/model/use-validate-activation.ts"),
      readSource("src/shared/actions/auth/auth.actions.ts"),
      readSource("src/shared/actions/auth/index.ts"),
      readSource("src/shared/actions/auth/auth.types.ts"),
    ]);

  assert.notEqual(activationModel, "", "activation preflight query hook is missing");
  assert.match(actions, /\/auth\/order-activation\/validate/u);
  assert.match(actionIndex, /validateOrderActivation/u);
  const validityBody = authTypes.match(
    /export type OrderActivationValidityDTO\s*=\s*\{(?<body>[\s\S]*?)\};/u,
  )?.groups?.body;
  assert.ok(validityBody, "activation validity response type is missing");
  assert.match(validityBody, /valid:\s*boolean/u);
  assert.doesNotMatch(validityBody, /email|account|order|token|user/ui);
  assert.match(activationForm, /useValidateActivation/u);
  assert.match(activationForm, /Завершите регистрацию/u);
  assert.match(activationForm, /Завершить регистрацию/u);
  assert.doesNotMatch(activationForm, /Активировать аккаунт/u);
  assert.match(activationForm, /Повторить/u);
  assert.match(activationForm, /загруз|провер/ui);
  assert.match(activationForm, /Ссылка недействительна или истекла/u);

  const temporaryState = activationForm.match(/Повторить[\s\S]{0,600}/u)?.[0] ?? "";
  assert.doesNotMatch(temporaryState, /истек|недействительн/ui);
  assert.doesNotMatch(actions, /order-activation\/validate\?(?:token|\$\{)/u);
  assert.doesNotMatch(`${activationForm}\n${activationMutation}\n${activationModel}`, /email/ui);
});

test("forgot-password navigates to canonical recovery and legacy request-only frontend code is absent", async () => {
  const [authForm, authModelIndex, authLibIndex, actions, actionIndex, authTypes, requestHook] =
    await Promise.all([
      readSource("src/features/auth/ui/auth-form.tsx"),
      readSource("src/features/auth/model/index.ts"),
      readSource("src/features/auth/lib/index.ts"),
      readSource("src/shared/actions/auth/auth.actions.ts"),
      readSource("src/shared/actions/auth/index.ts"),
      readSource("src/shared/actions/auth/auth.types.ts"),
      readSource("src/features/auth/model/use-request-password-reset.ts"),
    ]);

  assert.match(authForm, /href=\{routes\.authRecovery\}[\s\S]{0,200}Забыли пароль\?/u);
  assert.doesNotMatch(authForm, /PasswordResetRequestForm|isPasswordResetRequested/u);
  assert.equal(requestHook, "");
  assert.doesNotMatch(authModelIndex, /useRequestPasswordResetMutation/u);
  assert.doesNotMatch(authLibIndex, /passwordResetRequestFormSchema|toPasswordResetRequestInput|PasswordResetRequestFormValues/u);
  assert.doesNotMatch(actions, /function requestPasswordReset|\/auth\/password-reset\/request/u);
  assert.doesNotMatch(actionIndex, /requestPasswordReset/u);
  assert.doesNotMatch(authTypes, /RequestPasswordResetInputDTO/u);
  assert.match(actions, /function confirmPasswordReset|\/auth\/password-reset\/confirm/u);
  assert.match(actionIndex, /confirmPasswordReset/u);
  assert.match(authTypes, /ConfirmPasswordResetInputDTO/u);
});

test("password reset invalid-link CTA opens recovery while success CTA opens auth", async () => {
  const authForm = await readSource("src/features/auth/ui/auth-form.tsx");
  const passwordResetForm = authForm.slice(
    authForm.indexOf("export function PasswordResetForm"),
    authForm.indexOf("function RegisterForm"),
  );

  assert.match(
    passwordResetForm,
    /href=\{routes\.authRecovery\}[\s\S]{0,160}Запросить новую ссылку/u,
  );
  assert.match(passwordResetForm, /href=\{routes\.auth\}[\s\S]{0,160}Войти/u);
});

test("recovery success can reset to another email or return to login while keeping generic copy", async () => {
  const recoveryForm = await readSource("src/features/account-recovery/ui/recovery-form.tsx");

  assert.match(recoveryForm, /Если аккаунт связан с этим email/u);
  assert.doesNotMatch(recoveryForm, /аккаунт (?:найден|не найден)|пользователь (?:найден|не найден)/ui);
  assert.match(recoveryForm, /Указать другой email/u);
  assert.match(recoveryForm, /setIsSubmitted\(false\)/u);
  assert.match(recoveryForm, /Вернуться ко входу/u);
  assert.match(recoveryForm, /href=\{routes\.auth\}/u);
});

test("auth transport syncs activation cookie and mutation synchronizes session before account redirect", async () => {
  const [actions, actionIndex, activationMutation] = await Promise.all([
    readSource("src/shared/actions/auth/auth.actions.ts"),
    readSource("src/shared/actions/auth/index.ts"),
    readSource("src/features/order-activation/model/use-confirm-activation.ts"),
  ]);

  assert.match(actions, /\/auth\/recovery\/request/u);
  assert.match(actions, /\/auth\/order-activation\/confirm/u);
  assert.match(actions, /order-activation\/confirm[\s\S]*syncAccessTokenCookie:\s*true/u);
  assert.match(actionIndex, /requestAccountRecovery/u);
  assert.match(actionIndex, /confirmOrderActivation/u);
  assert.match(activationMutation, /sessionQuery\.getSession\(\)\.queryKey/u);
  assert.match(activationMutation, /setQueryData/u);
  assert.match(activationMutation, /routes\.account/u);
  assert.ok(
    activationMutation.indexOf("setQueryData") < activationMutation.indexOf("routes.account"),
    "session cache must be synchronized before redirect",
  );
});

test("recovery and activation analytics are typed, success-only, and contain no PII fields", async () => {
  const [types, factory, recoveryAnalytics, activationAnalytics, recoveryMutation, activationMutation] =
    await Promise.all([
      readSource("src/shared/lib/analytics/types.ts"),
      readSource("src/shared/lib/analytics/create-analytics.ts"),
      readSource("src/features/account-recovery/lib/analytics.ts"),
      readSource("src/features/order-activation/lib/analytics.ts"),
      readSource("src/features/account-recovery/model/use-request-recovery.ts"),
      readSource("src/features/order-activation/model/use-confirm-activation.ts"),
    ]);
  const analyticsSource = `${recoveryAnalytics}\n${activationAnalytics}`;

  assert.match(types, /account_recovery_requested/u);
  assert.match(types, /order_activation_completed/u);
  assert.match(factory, /account_recovery_requested/u);
  assert.match(factory, /order_activation_completed/u);
  assert.match(recoveryAnalytics, /createAnalytics/u);
  assert.match(activationAnalytics, /createAnalytics/u);
  assert.doesNotMatch(analyticsSource, /email|password|token|user_id|order_id|phone/ui);
  assert.match(recoveryMutation, /onSuccess[\s\S]*analytics\.recoveryRequested\(\)/u);
  assert.match(activationMutation, /onSuccess[\s\S]*analytics\.activationCompleted\(\)/u);
  assert.doesNotMatch(`${recoveryMutation}\n${activationMutation}`, /window\.(?:dataLayer|ym)/u);

  const sharedAnalytics = await loadSharedAnalytics();
  const recoveryAdapter = evaluateTypeScript(recoveryAnalytics, {
    "@/shared/lib/analytics": sharedAnalytics,
  });
  const activationAdapter = evaluateTypeScript(activationAnalytics, {
    "@/shared/lib/analytics": sharedAnalytics,
  });
  const previousWindow = globalThis.window;
  globalThis.window = { dataLayer: [] };

  try {
    recoveryAdapter.useAnalytics().recoveryRequested();
    activationAdapter.useAnalytics().activationCompleted();
    assert.deepEqual(globalThis.window.dataLayer, [
      { event: "account_recovery_requested" },
      { event: "order_activation_completed" },
    ]);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
