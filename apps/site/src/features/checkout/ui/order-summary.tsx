"use client";

import Image from "next/image";
import { LoaderCircle, Truck } from "lucide-react";

import type { Cart, CartItem } from "@/entities/cart";
import { useDevelopmentBanner } from "@/entities/feature-banners";
import { useSession } from "@/entities/session";
import { PromoCodeForm } from "@/features/promocode";
import { cn, shouldBypassNextImageOptimization } from "@/shared/lib";
import { getQueryOwner } from "@/shared/lib/query-keys";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Separator,
} from "@/shared/ui";

import {
  checkoutOrderFormId,
  formatEstimatedDeliveryDateRange,
  formatMoney,
  useCheckout,
  type CheckoutCalculationState,
} from "../lib";

import { CheckoutSubmitButton } from "./checkout-submit-button";

export function OrderSummary({
  cart,
  isSubmitDisabled,
  isSubmitting,
  submitLabel,
}: {
  cart: Cart;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  const { isPending, user } = useSession();
  const { hasDevelopmentBanner } = useDevelopmentBanner({
    enabled: !isPending,
    owner: getQueryOwner(user?.id),
  });
  const { checkoutCalculation, selectedDelivery } = useCheckout();
  const calculation =
    checkoutCalculation.status === "ready" ? checkoutCalculation.calculation : undefined;
  const deliveryProviderName =
    calculation?.delivery.provider === "cdek"
      ? "СДЭК"
      : calculation?.delivery.provider === "ozon"
        ? "Ozon"
        : undefined;
  const deliveryPrice = calculation?.deliveryPrice;
  const estimatedDeliveryDate = formatEstimatedDeliveryDateRange(
    calculation?.estimatedDeliveryDateRange,
  );
  const hasDelivery = Boolean(selectedDelivery);
  const visibleItems = cart.items.slice(0, 2);
  const hiddenItems = cart.items.slice(2);

  return (
    <Card
      className={cn(
        "lg:sticky lg:flex lg:flex-col",
        hasDevelopmentBanner
          ? "lg:top-[calc(var(--site-header-banner-height)+var(--site-header-nav-height)+1px+1rem)] lg:max-h-[calc(100dvh-var(--site-header-banner-height)-var(--site-header-nav-height)-var(--site-cookie-consent-height)-1px-2rem)]"
          : "lg:top-[calc(var(--site-header-nav-height)+1rem)] lg:max-h-[calc(100dvh-var(--site-header-nav-height)-var(--site-cookie-consent-height)-2rem)]",
        )}
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic={true}>
        {getCalculationAnnouncement(checkoutCalculation)}
      </p>
      <CardHeader className="shrink-0">
        <CardTitle>Ваш заказ</CardTitle>
        <CardDescription>{formatCartItemCount(cart.itemsCount)} в корзине</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <ul className="space-y-3">
          {visibleItems.map((item) => (
            <OrderItem key={item.id} item={item} />
          ))}
        </ul>
        {hiddenItems.length > 0 ? (
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted-foreground">
              Еще {formatHiddenPositionCount(hiddenItems.length)}
            </summary>
            <ul className="space-y-3 pt-1">
              {hiddenItems.map((item) => (
                <OrderItem key={item.id} item={item} />
              ))}
            </ul>
          </details>
        ) : null}

        <Separator />

        <PromoCodeForm />

        <Separator />

        <div
          className={cn(
            "rounded-lg border bg-muted/30 p-3 text-sm",
            calculation && "border-emerald-200 bg-emerald-50/60",
          )}
        >
          <div className="flex items-start gap-2">
            {checkoutCalculation.status === "pending" ? (
              <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Truck
                className={cn(
                  "mt-0.5 size-4 shrink-0 text-muted-foreground",
                  calculation && "text-emerald-600",
                )}
              />
            )}
            <div className="min-w-0 space-y-1">
              <p className="font-medium">
                {deliveryProviderName
                  ? `${deliveryProviderName}, пункт выдачи`
                  : hasDelivery
                    ? "Пункт выбран"
                    : "Доставка не выбрана"}
              </p>
              <p className="text-xs text-muted-foreground">
                {getDeliveryDescription(checkoutCalculation, hasDelivery)}
              </p>
              {calculation?.delivery.pickupPoint ? (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p>{calculation.delivery.pickupPoint.address}</p>
                  <p>{calculation.delivery.pickupPoint.workHours}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Товары</span>
            <span className="font-medium">{formatMoney(cart.subtotal)}</span>
          </div>
          {calculation && calculation.discount > 0 ? (
            <div className="flex items-center justify-between gap-4 text-emerald-700">
              <span>Скидка{calculation.promoCode ? ` (${calculation.promoCode})` : ""}</span>
              <span className="font-medium">-{formatMoney(calculation.discount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Доставка</span>
            <span className="font-medium">
              {getDeliveryPriceLabel(checkoutCalculation, deliveryPrice)}
            </span>
          </div>
          {estimatedDeliveryDate ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Дата доставки</span>
              <span className="text-right font-medium">{estimatedDeliveryDate}</span>
            </div>
          ) : null}
        </div>

        <Separator />

      </CardContent>
      <CardFooter className="shrink-0 flex-col items-stretch gap-4">
        <div className="flex w-full items-center justify-between text-lg font-semibold">
          <span>Итого</span>
          <span>
            {getTotalLabel(checkoutCalculation)}
          </span>
        </div>

        <div className="hidden lg:block">
          <CheckoutSubmitButton
            form={checkoutOrderFormId}
            disabled={isSubmitDisabled}
            isSubmitting={isSubmitting}
            className="min-h-11 w-full"
          >
            {submitLabel}
          </CheckoutSubmitButton>
        </div>
      </CardFooter>
    </Card>
  );
}

function getDeliveryDescription(
  calculationState: CheckoutCalculationState,
  hasDelivery: boolean,
) {
  switch (calculationState.status) {
    case "idle":
      return hasDelivery
        ? "Стоимость доставки пока недоступна."
        : "Выберите город и ПВЗ в блоке доставки.";
    case "pending":
      return "Обновляем стоимость доставки.";
    case "offline":
      return "Нет сети. Стоимость доставки пока недоступна.";
    case "error":
      return "Стоимость доставки временно недоступна.";
    case "ready":
      return "Стоимость доставки уже учтена в итоговой сумме.";
  }
}

function getDeliveryPriceLabel(
  calculationState: CheckoutCalculationState,
  deliveryPrice: number | undefined,
) {
  switch (calculationState.status) {
    case "idle":
      return "Выберите ПВЗ";
    case "pending":
      return "Считаем";
    case "offline":
      return "Нет сети";
    case "error":
      return "Недоступно";
    case "ready":
      return formatMoney(deliveryPrice ?? calculationState.calculation.deliveryPrice);
  }
}

function getTotalLabel(calculationState: CheckoutCalculationState) {
  switch (calculationState.status) {
    case "idle":
    case "error":
      return "Недоступно";
    case "pending":
      return "Пересчитываем";
    case "offline":
      return "Нет сети";
    case "ready":
      return formatMoney(calculationState.calculation.total);
  }
}

function getCalculationAnnouncement(calculationState: CheckoutCalculationState) {
  switch (calculationState.status) {
    case "pending":
      return "Обновляем стоимость доставки.";
    case "ready":
      return `Стоимость доставки ${formatMoney(calculationState.calculation.deliveryPrice)}. Итого ${formatMoney(calculationState.calculation.total)}.`;
    case "idle":
    case "offline":
    case "error":
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
      <p className="shrink-0 text-sm font-semibold">{formatMoney(item.lineTotal)}</p>
    </li>
  );
}

function formatHiddenPositionCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} позиция`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} позиции`;
  }

  return `${count} позиций`;
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
