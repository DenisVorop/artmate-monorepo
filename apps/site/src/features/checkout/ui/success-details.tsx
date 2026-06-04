"use client";

import { AlertCircle, CheckCircle2, Clock3, ShoppingBag, type LucideIcon } from "lucide-react";

import {
  getCdekShipment,
  getOrderShipmentNumberLabel,
  getOrderShipmentStatusLabel,
  ShipmentTrackingNumber,
} from "@/entities/orders";
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

import { InfoBlock } from "./info-block";

type CheckoutSuccessDetailsProps = {
  isCheckingPayment?: boolean;
  order: CheckoutOrder;
  paymentStatus: CheckoutOrder["payment"]["status"];
};

const paymentStatusMeta = {
  failed: {
    Icon: AlertCircle,
    iconClassName: "bg-rose-50 text-rose-600 ring-rose-200",
    title: "Оплата не прошла",
    description:
      "Заказ создан, но Ozon сообщил об ошибке оплаты. Попробуйте оформить заказ заново или свяжитесь с нами.",
    statusTitle: "Оплата не прошла",
    statusDescription: "Если деньги списались, напишите нам - проверим платеж вручную.",
  },
  paid: {
    Icon: CheckCircle2,
    iconClassName: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    title: "Оплата получена",
    description: "Заказ оплачен. Мы подготовим его к передаче в доставку.",
    statusTitle: "Заказ оплачен",
    statusDescription: "Статус доставки появится после обработки заказа.",
  },
  pending: {
    Icon: Clock3,
    iconClassName: "bg-amber-50 text-amber-600 ring-amber-200",
    title: "Проверяем оплату",
    description:
      "Заказ создан. Если вы уже оплатили его в Ozon, статус обновится после уведомления платежной системы.",
    statusTitle: "Ожидаем подтверждение оплаты",
    statusDescription: "Страница обновляет статус автоматически.",
  },
} satisfies Record<
  CheckoutOrder["payment"]["status"],
  {
    Icon: LucideIcon;
    description: string;
    iconClassName: string;
    statusDescription: string;
    statusTitle: string;
    title: string;
  }
>;

export function CheckoutSuccessDetails({
  isCheckingPayment = false,
  order,
  paymentStatus,
}: CheckoutSuccessDetailsProps) {
  const status = paymentStatusMeta[paymentStatus];
  const StatusIcon = status.Icon;
  const cdekShipment = getCdekShipment(order);
  const cdekShipmentStatus = getOrderShipmentStatusLabel(cdekShipment);
  const cdekShipmentNumber = getOrderShipmentNumberLabel(cdekShipment);

  return (
    <section className="container py-10 md:py-14">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="items-start gap-4 border-b">
          <span
            className={`flex size-12 items-center justify-center rounded-lg ring-1 ${status.iconClassName}`}
          >
            <StatusIcon className="size-6" />
          </span>
          <div className="space-y-2">
            <CardTitle className="text-2xl">{status.title}</CardTitle>
            <CardDescription>
              Заказ {order.id}. {status.description}
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
              <p>{status.statusTitle}</p>
              <p>{isCheckingPayment ? "Проверяем статус оплаты..." : status.statusDescription}</p>
            </InfoBlock>

            <InfoBlock title="Доставка">
              <p>{order.delivery.provider === "cdek" ? "СДЭК" : "Ozon"}</p>
              {order.delivery.provider === "cdek" && (
                <p>{cdekShipmentStatus ?? getPendingCdekShipmentStatus(order)}</p>
              )}
              {cdekShipmentNumber && <ShipmentTrackingNumber number={cdekShipmentNumber} />}
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

function getPendingCdekShipmentStatus(order: CheckoutOrder) {
  return order.payment.status === "paid" ? "Скоро передадим в СДЭК" : "Появится после оплаты";
}
