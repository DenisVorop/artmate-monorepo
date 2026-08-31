"use client";

import Image from "next/image";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CreditCard,
  MapPin,
  PackageCheck,
  Truck,
} from "lucide-react";
import { useId, useState } from "react";

import { routes } from "@/shared/constants";
import { cn, shouldBypassNextImageOptimization } from "@/shared/lib";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CtaGradientLink,
  Separator,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { getCdekShipment, getOrderShipmentNumberLabel, getOrderShipmentStatusLabel } from "../lib";
import type { Order } from "../model";
import { ShipmentTrackingNumber } from "./shipment-tracking-number";

type OrderCardProps = {
  order: Order;
};

const orderStatusMeta = {
  new: {
    label: "В обработке",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  in_progress: {
    label: "В работе",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  waiting_payment: {
    label: "Ожидает оплаты",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  paid: {
    label: "Оплачен",
    className: "border-teal-200 bg-teal-50 text-teal-700",
  },
  delivering: {
    label: "Доставляется",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  completed: {
    label: "Завершен",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  cancelled: {
    label: "Отменен",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
} satisfies Record<Order["status"], { label: string; className: string }>;

export function OrderCard({ order }: OrderCardProps) {
  const [areItemsExpanded, setAreItemsExpanded] = useState(false);
  const itemsListId = useId();
  const status = orderStatusMeta[order.status];
  const hiddenItemsCount = Math.max(order.items.length - 3, 0);
  const visibleItems = areItemsExpanded ? order.items : order.items.slice(0, 3);
  const hasHiddenItems = hiddenItemsCount > 0;
  const cdekShipment = getCdekShipment(order);
  const cdekShipmentStatus = getOrderShipmentStatusLabel(cdekShipment);
  const cdekShipmentNumber = getOrderShipmentNumberLabel(cdekShipment);
  const paymentUrl = getOrderPaymentUrl(order);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-5 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-start">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">Заказ {order.id}</CardTitle>
            <Badge variant="outline" className={cn("rounded-lg", status.className)}>
              {status.label}
            </Badge>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {formatDate(order.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PackageCheck className="size-4" />
              {order.itemsCount} {getItemsWord(order.itemsCount)}
            </span>
          </CardDescription>
        </div>

        <div className="grid gap-3 sm:justify-self-end">
          <div className="space-y-1 sm:text-right">
            <p className="text-sm text-muted-foreground">Итого</p>
            <p className="text-2xl font-semibold">{formatMoney(order.total)}</p>
            {order.discount > 0 ? (
              <p className="text-sm font-medium text-emerald-700">
                Скидка{order.promoCode ? ` ${order.promoCode}` : ""}: -{formatMoney(order.discount)}
              </p>
            ) : null}
          </div>
          {paymentUrl && (
            <Button
              asChild
              size="lg"
              className="w-full border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95 focus-visible:ring-rose-400/30"
            >
              <CtaGradientLink href={paymentUrl}>
                <CreditCard data-icon="inline-start" />
                Оплатить заказ
              </CtaGradientLink>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div className="space-y-1 rounded-lg border bg-muted/30 p-4">
            <p className="font-medium">Получатель</p>
            <p className="text-muted-foreground">{order.customer.name}</p>
            <p className="text-muted-foreground">{order.customer.phone}</p>
            <p className="text-muted-foreground">{order.customer.email}</p>
          </div>

          <div className="space-y-1 rounded-lg border bg-muted/30 p-4">
            <p className="flex items-center gap-2 font-medium">
              <MapPin className="size-4 text-rose-500" />
              Доставка
            </p>
            <p className="text-muted-foreground">
              {order.delivery.provider === "cdek" ? "СДЭК" : "Ozon"}
            </p>
            <p className="text-muted-foreground">Стоимость: {formatMoney(order.deliveryPrice)}</p>
            <p className="text-muted-foreground">{order.delivery.pickupPoint.address}</p>
            <p className="text-muted-foreground">{order.delivery.pickupPoint.workHours}</p>
            {order.delivery.provider === "cdek" && (
              <div className="mt-3 space-y-1 rounded-lg border bg-background/70 p-3">
                <p className="flex items-center gap-2 font-medium">
                  <Truck className="size-4 text-cyan-600" />
                  Статус
                </p>
                <p className="text-muted-foreground">
                  {cdekShipmentStatus ?? getPendingCdekShipmentStatus(order)}
                </p>
                {cdekShipmentNumber && (
                  <ShipmentTrackingNumber
                    className="text-muted-foreground"
                    number={cdekShipmentNumber}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div id={itemsListId} className="space-y-3">
            {visibleItems.map((item) => (
              <OrderItemRow key={item.id} item={item} />
            ))}
          </div>

          {hasHiddenItems && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={areItemsExpanded}
              aria-controls={itemsListId}
              className="w-full sm:w-auto"
              onClick={() => setAreItemsExpanded((currentValue) => !currentValue)}
            >
              {areItemsExpanded ? (
                <ChevronUp data-icon="inline-start" />
              ) : (
                <ChevronDown data-icon="inline-start" />
              )}
              {areItemsExpanded
                ? "Свернуть товары"
                : `Показать ещё ${hiddenItemsCount} ${getItemsWord(hiddenItemsCount)}`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type OrderItem = Order["items"][number];

function OrderItemRow({ item }: { item: OrderItem }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)_auto] gap-3">
      <Link
        href={routes.product(item.categorySlug, item.slug)}
        className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted"
      >
        <Image
          fill
          src={item.image}
          alt={item.title}
          unoptimized={shouldBypassNextImageOptimization(item.image)}
          sizes="64px"
          className="object-cover"
        />
      </Link>

      <div className="min-w-0">
        <p className="truncate font-medium">{item.title}</p>
        {item.category && <p className="text-sm text-muted-foreground">{item.category}</p>}
      </div>

      <div className="text-right text-sm">
        <p className="font-medium">{formatMoney(item.lineTotal)}</p>
        <p className="text-muted-foreground">{item.quantity} шт.</p>
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getPendingCdekShipmentStatus(order: Order) {
  return order.payment.status === "paid" ? "Скоро передадим в СДЭК" : "Появится после оплаты";
}

function getOrderPaymentUrl(order: Order) {
  if (
    !isOnlineAcquiringOrder(order) ||
    order.status !== "waiting_payment" ||
    order.payment.status !== "pending"
  ) {
    return undefined;
  }

  return `${routes.checkoutPayment}?orderId=${encodeURIComponent(order.id)}`;
}

function isOnlineAcquiringOrder(order: Order) {
  return order.payment.method === "ozon_acquiring" || order.payment.method === "tbank_acquiring";
}

function getItemsWord(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "товаров";
  }

  if (lastDigit === 1) {
    return "товар";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "товара";
  }

  return "товаров";
}
