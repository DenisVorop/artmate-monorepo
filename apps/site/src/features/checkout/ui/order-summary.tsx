"use client";

import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import type { ReactNode, Ref } from "react";

import type { Cart, CartItem } from "@/entities/cart";
import type { PromoPreview } from "@/entities/promocode";
import { ProductPrice } from "@/entities/products";
import { useDevelopmentBanner } from "@/entities/feature-banners";
import { LoyaltyPoints } from "@/entities/loyalty";
import { useSession } from "@/entities/session";
import { getPromoPricingState, PromoCodeForm, usePromocode } from "@/features/promocode";
import { cn, shouldBypassNextImageOptimization } from "@/shared/lib";
import { getQueryOwner } from "@/shared/lib/query-keys";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  DataState,
  DiscountBreakdown,
  Separator,
} from "@/shared/ui";

import {
  checkoutOrderFormId,
  formatMoney,
  getCheckoutExpectedEarnedPoints,
  useCheckout,
  type CheckoutCalculationState,
} from "../lib";
import { getCheckoutPriceSummary } from "../lib/price-summary";

import { CheckoutSubmitButton } from "./checkout-submit-button";
import { LoyaltyField } from "./loyalty-field";
import { LegalField } from "./legal-field";

type OrderSummaryProps = {
  cart: Cart;
  createOrderError: Error | null;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  submitLabel: string;
  submitButtonRef?: Ref<HTMLButtonElement>;
};

export function OrderSummary(props: OrderSummaryProps) {
  const { isPending, user } = useSession();
  const { hasDevelopmentBanner } = useDevelopmentBanner({
    enabled: !isPending,
    owner: getQueryOwner(user?.id),
  });
  const { checkoutCalculation } = useCheckout();
  const promoPricing = getPromoPricingState(usePromocode());
  return (
    <BaseOrderSummary
      {...props}
      checkoutCalculation={checkoutCalculation}
      hasDevelopmentBanner={hasDevelopmentBanner}
      promoPreview={promoPricing.preview}
      isPromoReady={promoPricing.isReady}
      promoSlot={<PromoCodeForm />}
      loyaltySlot={<LoyaltyField />}
    />
  );
}

export function BaseOrderSummary({
  cart,
  createOrderError,
  isSubmitDisabled,
  isSubmitting,
  submitLabel,
  submitButtonRef,
  checkoutCalculation,
  hasDevelopmentBanner,
  promoPreview,
  isPromoReady,
  promoSlot,
  loyaltySlot,
}: OrderSummaryProps & {
  checkoutCalculation: CheckoutCalculationState;
  hasDevelopmentBanner: boolean;
  promoPreview?: PromoPreview;
  isPromoReady: boolean;
  promoSlot: ReactNode;
  loyaltySlot: ReactNode;
}) {
  const pricing = getCheckoutPriceSummary(cart, checkoutCalculation, promoPreview);
  const expectedEarnedPoints = getCheckoutExpectedEarnedPoints(checkoutCalculation);
  const discounts = [
    ...(pricing.saleDiscount > 0
      ? [{ label: "Скидки на товары", amount: formatMoney(pricing.saleDiscount) }]
      : []),
    ...(pricing.promoDiscount > 0
      ? [
          {
            label: `Промокод ${pricing.promoCode ?? ""}`.trim(),
            amount: formatMoney(pricing.promoDiscount),
          },
        ]
      : []),
    ...(pricing.loyaltyDiscount > 0
      ? [
          {
            label: "Баллами",
            detail: <LoyaltyPoints points={pricing.pointsToSpend} />,
            amount: formatMoney(pricing.loyaltyDiscount),
          },
        ]
      : []),
  ];

  return (
    <Card
      role="complementary"
      aria-labelledby="checkout-summary-heading"
      className={cn(
        "gap-0 overflow-hidden rounded-2xl py-0 shadow-sm lg:sticky lg:overflow-y-auto",
        hasDevelopmentBanner
          ? "lg:top-[calc(var(--site-header-banner-height)+var(--site-header-nav-height)+1px+1rem)] lg:max-h-[calc(100dvh-var(--site-header-banner-height)-var(--site-header-nav-height)-var(--site-cookie-consent-height)-1px-2rem)]"
          : "lg:top-[calc(var(--site-header-nav-height)+1rem)] lg:max-h-[calc(100dvh-var(--site-header-nav-height)-var(--site-cookie-consent-height)-2rem)]",
      )}
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic={true}>
        {getCalculationAnnouncement(checkoutCalculation)}
      </p>
      <CardHeader className="shrink-0 px-5 pt-5 pb-4">
        <CardTitle className="text-xl">
          <h2 id="checkout-summary-heading">Сумма заказа</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="shrink-0 space-y-1 px-5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span>{formatCartItemCount(cart.itemsCount)}</span>
          <span className="font-medium tabular-nums">{formatMoney(pricing.originalSubtotal)}</span>
        </div>
        <DiscountBreakdown total={formatMoney(pricing.totalDiscount)} rows={discounts} />
        <div className="flex items-center justify-between gap-4 text-sm">
          <span>Доставка</span>
          <span className="text-right font-medium tabular-nums">
            {getDeliveryPriceLabel(checkoutCalculation)}
          </span>
        </div>
        <div className="pt-5" aria-busy={checkoutCalculation.status === "pending" || !isPromoReady}>
          <div className="flex items-baseline justify-between gap-4 text-xl font-bold">
            <span>{pricing.includesDelivery ? "Итого" : "Сумма"}</span>
            <span className="tabular-nums">{formatMoney(pricing.amount)}</span>
          </div>
          {!pricing.includesDelivery ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Без учёта доставки</p>
          ) : null}
          {!isPromoReady || checkoutCalculation.status === "pending" ? (
            <p className="mt-1 text-xs text-muted-foreground">Обновляем расчёт…</p>
          ) : null}
          {expectedEarnedPoints !== undefined ? (
            <div
              className="mt-3 flex items-center justify-between gap-3 text-sm"
              aria-label={`Будет начислено ${expectedEarnedPoints} баллов`}
            >
              <span>Кешбэк баллами</span>
              <span className="text-right font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                <LoyaltyPoints points={expectedEarnedPoints} prefix="+" />
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="shrink-0 flex-col items-stretch gap-4 border-0 bg-transparent px-5 pt-4 pb-5">
        <LegalField />
        {createOrderError ? (
          <div role="alert" aria-live="assertive" aria-atomic={true}>
            <DataState
              variant="error"
              title="Не удалось создать заказ"
              description={createOrderError.message || "Проверьте данные и попробуйте ещё раз."}
              className="max-w-none"
            />
          </div>
        ) : null}
        <CheckoutSubmitButton
          ref={submitButtonRef}
          form={checkoutOrderFormId}
          disabled={isSubmitDisabled}
          isSubmitting={isSubmitting}
          className="min-h-12 w-full rounded-xl"
        >
          {submitLabel}
        </CheckoutSubmitButton>
      </CardFooter>
      <Separator />
      <div className="shrink-0 px-5">
        {promoSlot}
        {loyaltySlot}
        <Accordion type="single" collapsible className="border-t">
          <AccordionItem value="items" className="border-0">
            <AccordionTrigger className="min-h-12 items-center gap-2 hover:no-underline">
              <ShoppingBag className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1">Товары в заказе</span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <ul className="space-y-4">
                {cart.items.map((item) => (
                  <OrderItem key={item.id} item={item} />
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </Card>
  );
}

function getDeliveryPriceLabel(state: CheckoutCalculationState) {
  switch (state.status) {
    case "idle":
      return "После выбора пункта выдачи";
    case "pending":
      return "Рассчитываем…";
    case "offline":
    case "error":
      return "Пока не рассчитана";
    case "ready":
      return state.calculation.deliveryPrice === 0
        ? "Бесплатно"
        : formatMoney(state.calculation.deliveryPrice);
  }
}

function getCalculationAnnouncement(state: CheckoutCalculationState) {
  switch (state.status) {
    case "pending":
      return "Обновляем стоимость доставки.";
    case "ready":
      return `Стоимость доставки ${formatMoney(state.calculation.deliveryPrice)}. Итого ${formatMoney(state.calculation.total)}.`;
    default:
      return "";
  }
}

function OrderItem({ item }: { item: CartItem }) {
  return (
    <li className="flex gap-3">
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Image
          fill
          src={item.image}
          alt={item.title}
          unoptimized={shouldBypassNextImageOptimization(item.image)}
          sizes="48px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {item.quantity} шт. x {formatMoney(item.price)}
        </p>
      </div>
      <ProductPrice
        price={item.lineTotal}
        originalPrice={
          item.originalPrice === undefined ? undefined : item.originalPrice * item.quantity
        }
        className="max-w-28 shrink-0 text-right [&>div]:justify-end"
      />
    </li>
  );
}

function formatCartItemCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} товар`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} товара`;
  }

  return `${count} товаров`;
}
