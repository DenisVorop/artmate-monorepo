import Image from "next/image";
import { LoaderCircle } from "lucide-react";

import type { Cart } from "@/entities/cart";
import { shouldBypassNextImageOptimization } from "@/shared/lib";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Separator } from "@/shared/ui";

import { formatMoney, type CheckoutCalculation, type CheckoutDeliveryPoint } from "../lib";

type OrderSummaryProps = {
  cart: Cart;
  calculation?: CheckoutCalculation;
  selectedPoint?: CheckoutDeliveryPoint;
  isCalculationPending: boolean;
  isCalculationError: boolean;
};

export function OrderSummary({
  cart,
  calculation,
  selectedPoint,
  isCalculationPending,
  isCalculationError,
}: OrderSummaryProps) {
  const pickupPoint = calculation?.delivery.pickupPoint;
  const selectedPointTitle = pickupPoint?.title ?? selectedPoint?.name;
  const selectedPointAddress = pickupPoint?.address ?? selectedPoint?.address;
  const selectedPointWorkHours = pickupPoint?.workHours ?? selectedPoint?.work_hours;

  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader>
        <CardTitle>Ваш заказ</CardTitle>
        <CardDescription>
          {cart.itemsCount} товаров с расчетом доставки Ozon Pickup
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {cart.items.map((item) => (
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
        </ul>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Товары</span>
            <span className="font-medium">{formatMoney(calculation?.subtotal ?? cart.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Доставка</span>
            <span className="font-medium">
              {isCalculationPending && (
                <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
              )}
              {!isCalculationPending &&
                (isCalculationError
                  ? "недоступно"
                  : calculation
                    ? formatMoney(calculation.deliveryPrice)
                    : "—")}
            </span>
          </div>
        </div>

        {selectedPointTitle && selectedPointAddress && selectedPointWorkHours && (
          <>
            <Separator />
            <div className="space-y-1 text-sm">
              <p className="font-medium">{selectedPointTitle}</p>
              <p className="text-muted-foreground">{selectedPointAddress}</p>
              <p className="text-muted-foreground">{selectedPointWorkHours}</p>
            </div>
          </>
        )}

        <Separator />

        <div className="flex items-center justify-between text-lg font-semibold">
          <span>К оплате</span>
          <span>{calculation ? formatMoney(calculation.total) : "—"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
