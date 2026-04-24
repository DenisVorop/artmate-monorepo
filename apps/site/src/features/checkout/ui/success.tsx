import { CheckCircle2, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";

import type { OrderDTO } from "@/shared/actions/orders";
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

import { formatMoney } from "../lib";

import { CheckoutSuccessCartReset } from "./success-cart-reset";

type CheckoutSuccessProps = {
  order: OrderDTO;
};

export function CheckoutSuccess({ order }: CheckoutSuccessProps) {
  return (
    <section className="container py-10 md:py-14">
      <CheckoutSuccessCartReset />

      <Card className="mx-auto max-w-3xl">
        <CardHeader className="items-start gap-4 border-b">
          <span className="flex size-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
            <CheckCircle2 className="size-6" />
          </span>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Заказ оплачен</CardTitle>
            <CardDescription>
              Заказ {order.id} принят. Мы подготовим отправление и передадим его в выбранный ПВЗ
              Ozon.
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

            <InfoBlock title="Пункт выдачи">
              <p>{order.delivery.pickupPoint.title}</p>
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

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">{title}</p>
      <div className="space-y-1 text-muted-foreground">{children}</div>
    </div>
  );
}
