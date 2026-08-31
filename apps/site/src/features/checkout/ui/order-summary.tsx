import Image from "next/image";
import { LoaderCircle, RefreshCw, Truck } from "lucide-react";

import type { Cart } from "@/entities/cart";
import { PromoCodeForm } from "@/features/promocode";
import { cn, shouldBypassNextImageOptimization } from "@/shared/lib";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@/shared/ui";

import { formatEstimatedDeliveryDateRange, formatMoney, useCheckout } from "../lib";

type OrderSummaryProps = {
  cart: Cart;
  compact?: boolean;
};

export function OrderSummary({ cart, compact = false }: OrderSummaryProps) {
  const { checkoutCalculation, selectedDelivery } = useCheckout();
  const calculation = checkoutCalculation.calculation;
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
  const visibleItems = compact ? cart.items.slice(0, 2) : cart.items;
  const hiddenItemsCount = cart.items.length - visibleItems.length;

  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader>
        <CardTitle>Ваш заказ</CardTitle>
        <CardDescription>{formatCartItemCount(cart.itemsCount)} в корзине</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {visibleItems.map((item) => (
            <li key={item.id} className="flex gap-3">
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
          ))}
          {hiddenItemsCount > 0 ? (
            <li className="rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Еще {formatCartItemCount(hiddenItemsCount).toLocaleLowerCase("ru-RU")}
            </li>
          ) : null}
        </ul>

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
            {checkoutCalculation.isPending && !checkoutCalculation.isPaused ? (
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
                {checkoutCalculation.isPaused
                  ? "Нет сети. Повторите расчет стоимости заказа."
                  : calculation
                    ? "Стоимость доставки уже учтена в итоговой сумме."
                    : hasDelivery
                      ? "Обновляем стоимость доставки."
                      : "Выберите город и ПВЗ в блоке доставки."}
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
              {checkoutCalculation.isPaused
                ? "Нет сети"
                : checkoutCalculation.isPending
                  ? "Считаем"
                  : deliveryPrice === undefined
                    ? "Выберите ПВЗ"
                    : formatMoney(deliveryPrice)}
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

        {checkoutCalculation.isError ? (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="text-destructive" role="alert">
              {checkoutCalculation.error?.message ||
                "Не удалось пересчитать итоговую сумму заказа."}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={checkoutCalculation.retry}>
              <RefreshCw data-icon="inline-start" />
              Повторить расчет
            </Button>
          </div>
        ) : null}
        {checkoutCalculation.isPaused ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground" role="status">
              Нет сети. Итоговая сумма недоступна до повторного расчета.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={checkoutCalculation.retry}>
              <RefreshCw data-icon="inline-start" />
              Повторить расчет
            </Button>
          </div>
        ) : null}

        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Итого</span>
          <span>
            {checkoutCalculation.isPaused
              ? "Нет сети"
              : checkoutCalculation.isPending
                ? "Пересчитываем"
                : checkoutCalculation.isError || !calculation
                  ? "Недоступно"
                  : formatMoney(calculation.total)}
          </span>
        </div>
      </CardContent>
    </Card>
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
