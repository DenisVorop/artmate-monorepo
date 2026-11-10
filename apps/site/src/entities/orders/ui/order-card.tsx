"use client";

import { ChevronRight } from "lucide-react";
import { useId, useRef, useState, type MouseEvent } from "react";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { Badge, Button, Card, CardContent, CardHeader } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { getCdekShipment, getOrderDeliveryMilestone, getOrderShipmentNumberLabel } from "../lib";
import type { Order } from "../model";
import { formatDate, formatMoney, getItemsWord } from "../lib/order-formatters";
import { OrderDetails } from "./order-details";
import { OrderItemsPreview } from "./order-items-preview";
import { ShipmentTrackingNumber } from "./shipment-tracking-number";

type OrderCardProps = {
  order: Order;
  interactions?: {
    orderDetailsOpened: () => void;
    orderDetailsClosed: () => void;
    orderPaymentOpened: () => void;
    orderProductOpened: () => void;
    trackingCopied: () => void;
    trackingOpened: () => void;
  };
};

const orderStatusMeta = {
  new: { label: "В обработке", className: "bg-stone-100 text-stone-700" },
  in_progress: { label: "Готовим заказ", className: "bg-amber-50 text-amber-800" },
  waiting_payment: { label: "Ожидает оплаты", className: "bg-orange-50 text-orange-800" },
  paid: { label: "Оплачен", className: "bg-emerald-50 text-emerald-800" },
  delivering: { label: "В пути", className: "bg-sky-50 text-sky-800" },
  completed: { label: "Завершён", className: "bg-stone-100 text-stone-600" },
  cancelled: { label: "Отменён", className: "bg-stone-100 text-stone-600" },
} satisfies Record<Order["status"], { label: string; className: string }>;

export function OrderCard({ order, interactions }: OrderCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const detailsId = useId();
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();
  const status = orderStatusMeta[order.status];
  const shipment = getCdekShipment(order);
  const trackingNumber = getOrderShipmentNumberLabel(shipment);
  const deliveryMilestone =
    order.status === "delivering" ? getOrderDeliveryMilestone(shipment) : undefined;
  const paymentUrl = getOrderPaymentUrl(order);
  const singleItem = order.items.length === 1 ? order.items[0] : undefined;
  function openDetails(event: MouseEvent<HTMLButtonElement>) {
    returnFocusRef.current = event.currentTarget;
    interactions?.orderDetailsOpened();
    setIsDetailsOpen(true);
  }

  return (
    <Card
      role="article"
      aria-labelledby={headingId}
      className="gap-0 rounded-2xl py-0 shadow-none ring-border/70"
    >
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0 space-y-2.5">
          <Badge className={cn("rounded-full border-0 px-2.5 py-1 font-medium", status.className)}>
            {deliveryMilestone ?? status.label}
          </Badge>
          <div>
            <h3 id={headingId} className="text-base font-medium sm:text-lg">
              Заказ от {formatDate(order.createdAt)}
            </h3>
            <p className="mt-1 text-xs break-all text-muted-foreground">№ {order.id}</p>
          </div>
        </div>
        <p className="pt-1 text-right text-lg font-semibold whitespace-nowrap tabular-nums sm:text-xl">
          {formatMoney(order.total)}
        </p>
      </CardHeader>

      <CardContent className="px-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-5">
          <OrderItemsPreview
            items={order.items}
            onOpenDetails={openDetails}
            onProductOpen={interactions?.orderProductOpened}
            className={singleItem ? "w-15 shrink-0" : "w-full"}
          />
          <div className="min-w-0 flex-1 basis-36">
            {singleItem && (
              <Link
                href={routes.product(singleItem.categorySlug, singleItem.slug)}
                onClick={interactions?.orderProductOpened}
                className="mb-1 block text-sm font-medium break-words focus-visible:underline"
              >
                {singleItem.title}
              </Link>
            )}
            <p className="text-sm text-muted-foreground">
              {order.itemsCount} {getItemsWord(order.itemsCount)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/60 py-3">
          <Button
            type="button"
            variant="ghost"
            className="-ml-3 min-h-11 text-muted-foreground hover:text-foreground"
            aria-haspopup="dialog"
            aria-expanded={isDetailsOpen}
            aria-controls={isDetailsOpen ? detailsId : undefined}
            aria-label={`Подробнее о заказе ${order.id}`}
            onClick={openDetails}
          >
            Подробнее
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          {paymentUrl ? (
            <Button
              asChild
              className="min-h-11 bg-rose-600 px-4 text-white hover:bg-rose-700 hover:text-white focus-visible:ring-rose-500/30 sm:min-h-9"
            >
              <Link href={paymentUrl} onClick={interactions?.orderPaymentOpened}>
                Оплатить заказ
              </Link>
            </Button>
          ) : null}
          {trackingNumber ? (
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>СДЭК</span>
              <ShipmentTrackingNumber
                number={trackingNumber}
                onCopy={interactions?.trackingCopied}
                onTrack={interactions?.trackingOpened}
              />
            </div>
          ) : null}
        </div>
      </CardContent>
      <OrderDetails
        order={order}
        statusLabel={deliveryMilestone ?? status.label}
        open={isDetailsOpen}
        onProductOpen={interactions?.orderProductOpened}
        onOpenChange={(open) => {
          if (!open) interactions?.orderDetailsClosed();
          setIsDetailsOpen(open);
        }}
        contentId={detailsId}
        returnFocusRef={returnFocusRef}
      />
    </Card>
  );
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
