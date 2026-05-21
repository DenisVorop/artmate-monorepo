"use client";

import { CheckCircle2, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";

import { useOrderData } from "@/entities/orders";
import { routes } from "@/shared/constants";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { formatMoney, type CheckoutOrder } from "../lib";

type CheckoutSuccessProps = {
  orderId?: string;
};

export function CheckoutSuccess({ orderId }: CheckoutSuccessProps) {
  const { data: order, error, isError, isPending } = useOrderData({ orderId });

  if (!orderId) {
    return (
      <CheckoutSuccessState
        variant="error"
        title="Не найден номер заказа"
        description="Вернитесь в корзину и попробуйте оформить заказ заново."
      />
    );
  }

  if (isPending) {
    return <CheckoutSuccessState title="Загружаем заказ" description="Проверяем детали заказа." />;
  }

  if (isError || !order) {
    return (
      <CheckoutSuccessState
        variant="error"
        title="Не удалось загрузить заказ"
        description={error?.message ?? "Проверьте ссылку или попробуйте позже."}
      />
    );
  }

  return <CheckoutSuccessDetails order={order} />;
}

function CheckoutSuccessDetails({ order }: { order: CheckoutOrder }) {
  return (
    <section className="container py-10 md:py-14">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="items-start gap-4 border-b">
          <span className="flex size-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
            <CheckCircle2 className="size-6" />
          </span>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Заказ принят</CardTitle>
            <CardDescription>
              Заказ {order.id} принят. Мы свяжемся с вами для подтверждения деталей.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoBlock title="Получатель">
              <p>{order.customer.name}</p>
              <p>{order.customer.phone}</p>
              <p>{order.customer.email}</p>
            </InfoBlock>

            <InfoBlock title="Статус">
              <p>Заказ ожидает оплаты</p>
              <p>Менеджер отправит ссылку на оплату после проверки заказа.</p>
            </InfoBlock>

            <InfoBlock title="Доставка">
              <p>{order.delivery.provider === "cdek" ? "СДЭК" : "Ozon"}</p>
              <p>{order.delivery.pickupPoint.address}</p>
              <p>{order.delivery.pickupPoint.workHours}</p>
            </InfoBlock>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Товары</span>
              <span className="font-medium">{formatMoney(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Доставка</span>
              <span className="font-medium">{formatMoney(order.deliveryPrice)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-lg font-semibold">
              <span>Итого</span>
              <span>{formatMoney(order.total)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href={routes.catalog}>
                <ShoppingBag data-icon="inline-start" />
                Вернуться в каталог
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={routes.contacts}>Связаться с нами</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function CheckoutSuccessState({
  variant,
  title,
  description,
}: {
  variant?: "error";
  title: string;
  description: string;
}) {
  return (
    <section className="container py-10">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
            <div className="space-y-2">
              <CardTitle className={variant === "error" ? "text-destructive" : undefined}>
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>

            {variant === "error" && (
              <Button asChild>
                <Link href={routes.cart}>Вернуться в корзину</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">{title}</p>
      <div className="space-y-1 text-muted-foreground">{children}</div>
    </div>
  );
}
