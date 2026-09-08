import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function readSource(path) {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  } catch {
    return "";
  }
}

test("guest checkout creates the order immediately without an authentication gate", async () => {
  const [checkout, flow, form, calculationState, provider, context, hoc, legacyState] =
    await Promise.all([
    readSource("src/features/checkout/ui/checkout.tsx"),
    readSource("src/features/checkout/ui/checkout-flow.tsx"),
    readSource("src/features/checkout/lib/checkout-form.ts"),
    readSource("src/features/checkout/lib/calculation-state.ts"),
    readSource("src/features/checkout/lib/checkout-provider/checkout-provider.tsx"),
    readSource("src/features/checkout/lib/checkout-provider/checkout.context.tsx"),
    readSource("src/features/checkout/lib/checkout-provider/with-checkout.tsx"),
    readSource("src/features/checkout/lib/auth-confirmation-state.ts"),
    ]);

  assert.match(checkout, /const handleSubmit[\s\S]*await createOrder\(variables\)/u);
  assert.doesNotMatch(checkout, /if\s*\(!user\)|onAuthRequired|onManualConfirmation/u);
  assert.doesNotMatch(`${checkout}\n${flow}\n${form}\n${provider}\n${context}\n${hoc}`, /requiresAuth/u);
  assert.equal(legacyState, "");

  assert.match(calculationState, /case "ready":[\s\S]*return "Перейти к оплате"/u);
});

test("guest success and failure UI are neutral and never import order queries or render identifiers", async () => {
  const [guestSuccess, guestFailure] = await Promise.all([
    readSource("src/features/checkout/ui/guest-success.tsx"),
    readSource("src/features/checkout/ui/guest-failure.tsx"),
  ]);
  const neutralSource = `${guestSuccess}\n${guestFailure}`;

  assert.match(guestSuccess, /Оплата проверяется/u);
  assert.doesNotMatch(guestSuccess, /ссылка активации|создать пароль/ui);
  assert.match(guestFailure, /usePaymentRecovery/u);
  assert.match(guestFailure, /Проверить оплату/u);
  assert.match(guestFailure, /Проверяем оплату/u);
  assert.match(guestFailure, /Попробовать оплатить снова|Продолжить оплату/u);
  assert.match(guestFailure, /Проверьте оплату позже/u);
  assert.doesNotMatch(
    neutralSource,
    /@\/entities\/orders|useOrderData|useOrderStatusData|ordersQuery|номер заказа|Заказ\s/u,
  );
  assert.doesNotMatch(guestFailure, />\s*\{orderId\}\s*</u);
});

test("checkout contact and guest success explain that access mail is sent at checkout, before payment", async () => {
  const [contactFields, guestSuccess, activationForm] = await Promise.all([
    readSource("src/features/checkout/ui/contact-fields.tsx"),
    readSource("src/features/checkout/ui/guest-success.tsx"),
    readSource("src/features/order-activation/ui/activation-form.tsx"),
  ]);

  assert.match(contactFields, /Пришлём чек и информацию о заказе\./u);
  assert.match(contactFields, /checkout-phone-error/u);
  assert.match(
    contactFields,
    /После оформления пришлём письмо для входа или завершения регистрации\./u,
  );
  assert.match(guestSuccess, /письмо для входа или восстановления доступа отправлены на email\./u);
  assert.doesNotMatch(`${contactFields}\n${guestSuccess}`, /после оплаты|Если аккаунта ещё нет/ui);
  assert.doesNotMatch(guestSuccess, /ссылка активации|создать пароль/ui);
  assert.match(activationForm, /<CardTitle>Завершите регистрацию<\/CardTitle>/u);
});

test("checkout prefills the recipient phone from the authenticated user", async () => {
  const checkout = await readSource("src/features/checkout/ui/checkout.tsx");

  assert.match(checkout, /user\?\.phone\s*\?\s*\{ phone: user\.phone \}/u);
});

test("checkout result routes select neutral guest UI while authenticated owners retain details and polling", async () => {
  const [successRoute, failureRoute, successPage, failurePage, ownerSuccess, ownerFailure] =
    await Promise.all([
      readSource("app/(site)/checkout/success/page.tsx"),
      readSource("app/(site)/checkout/failure/page.tsx"),
      readSource("src/_pages/checkout-success/index.tsx"),
      readSource("src/_pages/checkout-failure/index.tsx"),
      readSource("src/features/checkout/ui/success.tsx"),
      readSource("src/features/checkout/ui/failure.tsx"),
    ]);

  for (const route of [successRoute, failureRoute]) {
    assert.match(route, /getAuthSession/u);
    assert.match(route, /session\?\.user/u);
  }
  assert.match(successPage, /GuestCheckoutSuccess/u);
  assert.match(failurePage, /GuestCheckoutFailure/u);
  assert.match(failureRoute, /getOrder/u);
  assert.match(
    failureRoute,
    /session\?\.user\s*&&\s*normalizedOrderId[\s\S]*getOrder\(normalizedOrderId\)/u,
  );
  assert.match(failureRoute, /hasOwnerOrder=\{hasOwnerOrder\}/u);
  assert.match(failurePage, /hasOwnerOrder\s*&&\s*orderId/u);
  assert.doesNotMatch(failurePage, /isAuthenticated/u);
  assert.match(failurePage, /GuestCheckoutFailure orderId=\{orderId\}/u);
  assert.match(ownerSuccess, /useOrderData/u);
  assert.match(ownerSuccess, /useOrderStatusData/u);
  assert.match(ownerSuccess, /pollWhilePending:\s*true/u);
  assert.match(ownerFailure, /useOrderData/u);
});

test("payment route preserves owner redirects and renders cookie-protected neutral recovery for everyone else", async () => {
  const [paymentRoute, guestFailure, recoveryAction] = await Promise.all([
    readSource("app/(site)/checkout/payment/page.tsx"),
    readSource("src/features/checkout/ui/guest-failure.tsx"),
    readSource("src/shared/actions/orders/orders.actions.ts"),
  ]);

  assert.match(paymentRoute, /getAuthSession/u);
  assert.match(
    paymentRoute,
    /session\?\.user\s*&&\s*normalizedOrderId[\s\S]*getOrder\(normalizedOrderId\)/u,
  );
  assert.match(paymentRoute, /GuestCheckoutFailure|CheckoutFailurePage/u);
  assert.doesNotMatch(paymentRoute, /routes\.auth|getSafeAuthRedirectPath/u);
  assert.doesNotMatch(paymentRoute, /recoverOrderPayment/u);
  assert.match(guestFailure, /onClick=\{\(\) => orderId && recoverPayment\(orderId\)\}/u);
  assert.match(recoveryAction, /method:\s*"POST"/u);
});

test("legacy manual-confirmation tests, action, and copy are removed", async () => {
  const [buyerTest, checkout, flow, form, orderActions, orderActionIndex, orderTypes] = await Promise.all([
    readSource("test/promocodes-buyer.test.mjs"),
    readSource("src/features/checkout/ui/checkout.tsx"),
    readSource("src/features/checkout/ui/checkout-flow.tsx"),
    readSource("src/features/checkout/lib/checkout-form.ts"),
    readSource("src/shared/actions/orders/orders.actions.ts"),
    readSource("src/shared/actions/orders/index.ts"),
    readSource("src/shared/actions/orders/order.types.ts"),
  ]);
  const source = `${buyerTest}\n${checkout}\n${flow}\n${form}\n${orderActions}\n${orderActionIndex}\n${orderTypes}`;

  assert.doesNotMatch(
    source,
    /manual-confirmation|required.*auth|Войти и оплатить|Перед оплатой потребуется|confirmOrderPayment|confirm-payment/u,
  );
});
