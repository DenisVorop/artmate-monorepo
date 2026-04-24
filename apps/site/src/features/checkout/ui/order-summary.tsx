import Image from "next/image";

import type { Cart } from "@/entities/cart";
import type { OzonPickupPointDTO } from "@/shared/actions/orders";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Separator } from "@/shared/ui";

import { formatMoney } from "../lib";

type OrderSummaryProps = {
  cart: Cart;
  pickupPoint?: OzonPickupPointDTO;
};

export function OrderSummary({ cart, pickupPoint }: OrderSummaryProps) {
  const deliveryPrice = pickupPoint?.deliveryPrice ?? 0;
  const total = cart.subtotal + deliveryPrice;

  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader>
        <CardTitle>Ваш заказ</CardTitle>
        <CardDescription>{cart.itemsCount} товаров с доставкой в ПВЗ Ozon</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {cart.items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                <Image
                  fill
                  src={item.image}
                  alt={item.title}
                  sizes="56px"
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
            <span className="font-medium">{formatMoney(cart.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Доставка</span>
            <span className="font-medium">{formatMoney(deliveryPrice)}</span>
          </div>
        </div>

        {pickupPoint && (
          <>
            <Separator />
            <div className="space-y-1 text-sm">
              <p className="font-medium">{pickupPoint.title}</p>
              <p className="text-muted-foreground">{pickupPoint.address}</p>
              <p className="text-muted-foreground">{pickupPoint.workHours}</p>
            </div>
          </>
        )}

        <Separator />

        <div className="flex items-center justify-between text-lg font-semibold">
          <span>К оплате</span>
          <span>{formatMoney(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
