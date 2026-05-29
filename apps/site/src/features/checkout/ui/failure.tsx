"use client";

import { AlertCircle, Headphones, ShoppingBag } from "lucide-react";

import { useOrderData } from "@/entities/orders";
import { routes } from "@/shared/constants";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { getOrderLoadErrorMessage } from "../lib/checkout-success";

type CheckoutFailureProps = {
  orderId?: string;
};

export function CheckoutFailure({ orderId }: CheckoutFailureProps) {
  const { data: order, error, isError, isPending } = useOrderData({ orderId });
  const orderLabel = order?.id ?? orderId;

  return (
    <section className="container py-10 md:py-14">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="items-start gap-4 border-b">
          <span className="flex size-12 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-200">
            <AlertCircle className="size-6" />
          </span>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Оплата не прошла</CardTitle>
            <CardDescription>
              {orderLabel ? `Заказ ${orderLabel} создан, но оплата не была подтверждена.` : null}
              {!orderLabel
                ? "Ozon вернул вас после неуспешной оплаты."
                : " Если деньги списались, напишите нам - проверим платеж вручную."}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {orderId && isPending ? (
            <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Загружаем детали заказа.
            </p>
          ) : null}

          {isError ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {getOrderLoadErrorMessage(error)}
            </p>
          ) : null}

          {order ? (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-medium">
                Статус оплаты: {getPaymentStatusLabel(order.payment.status)}
              </p>
              <p className="mt-1 text-muted-foreground">
                Сумма заказа: {order.total.toLocaleString("ru-RU")} ₽
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href={routes.catalog}>
                <ShoppingBag data-icon="inline-start" />
                Вернуться в каталог
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={routes.contacts}>
                <Headphones data-icon="inline-start" />
                Связаться с нами
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function getPaymentStatusLabel(status: "failed" | "paid" | "pending") {
  switch (status) {
    case "failed":
      return "не прошла";
    case "paid":
      return "оплачено";
    case "pending":
      return "ожидает подтверждения";
  }
}
