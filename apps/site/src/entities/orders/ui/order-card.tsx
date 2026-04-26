"use client";

import Image from "next/image";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  MapPin,
  PackageCheck,
} from "lucide-react";
import { useId, useState } from "react";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import type { Order } from "../model";

type OrderCardProps = {
  order: Order;
};

const orderStatusMeta = {
  paid: {
    label: "Оплачен",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  pending_payment: {
    label: "Ожидает оплаты",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
} satisfies Record<Order["status"], { label: string; className: string }>;

export function OrderCard({ order }: OrderCardProps) {
  const [areItemsExpanded, setAreItemsExpanded] = useState(false);
  const itemsListId = useId();
  const status = orderStatusMeta[order.status];
  const hiddenItemsCount = Math.max(order.items.length - 3, 0);
  const visibleItems = areItemsExpanded ? order.items : order.items.slice(0, 3);
  const hasHiddenItems = hiddenItemsCount > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
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

        <div>
          <p className="text-sm text-muted-foreground">Итого</p>
          <p className="text-2xl font-semibold">{formatMoney(order.total)}</p>
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
              Пункт выдачи
            </p>
            <p className="text-muted-foreground">{order.delivery.pickupPoint.title}</p>
            <p className="text-muted-foreground">{order.delivery.pickupPoint.address}</p>
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
        className="relative aspect-square overflow-hidden rounded-lg bg-muted"
      >
        <Image fill src={item.image} alt={item.title} sizes="64px" className="object-cover" />
      </Link>

      <div className="min-w-0">
        <p className="truncate font-medium">{item.title}</p>
        <p className="text-sm text-muted-foreground">{item.category}</p>
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
