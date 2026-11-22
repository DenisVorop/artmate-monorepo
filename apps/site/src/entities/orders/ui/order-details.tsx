"use client";

import { MapPin, X } from "lucide-react";
import type { RefObject } from "react";
import { routes } from "@/shared/constants";
import { useIsMobile } from "@/shared/lib/device";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/shared/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerBody,
  DrawerTitle,
  DrawerDescription,
  DrawerHeader,
  DrawerClose,
} from "@/shared/ui/drawer";
import { Link } from "@/shared/ui/link";
import { formatDate, formatMoney } from "../lib/order-formatters";
import type { Order } from "../model";

type OrderDetailsProps = {
  order: Order;
  statusLabel: string;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onProductOpen?: () => void;
  contentId: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

const drawerModalProps = { autoFocus: true, handleOnly: true } as const;

export function OrderDetails({
  order,
  statusLabel,
  open,
  onOpenChange,
  onProductOpen,
  contentId,
  returnFocusRef,
}: OrderDetailsProps) {
  const isMobile = useIsMobile();
  const title = `Заказ от ${formatDate(order.createdAt)}`;
  const description = `№ ${order.id} · ${statusLabel}`;
  function restoreFocus(event: Event) {
    if (returnFocusRef.current) {
      event.preventDefault();
      returnFocusRef.current.focus({ preventScroll: true });
    }
  }

  if (isMobile) {
    return (
      <Drawer {...drawerModalProps} open={open} onOpenChange={onOpenChange}>
        <DrawerContent id={contentId} onCloseAutoFocus={restoreFocus}>
          <DrawerHeader className="relative shrink-0 px-5 pr-14 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <DrawerTitle className="leading-snug">{title}</DrawerTitle>
            <DrawerDescription className="break-words">{description}</DrawerDescription>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-2 size-11"
                aria-label="Закрыть подробности"
              >
                <X aria-hidden="true" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <DrawerBody className="px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <DetailsContent order={order} onProductOpen={onProductOpen} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id={contentId}
        onCloseAutoFocus={restoreFocus}
        className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogHeader className="shrink-0 px-6 pt-6 pr-14 pb-5">
          <DialogTitle className="leading-snug">{title}</DialogTitle>
          <DialogDescription className="break-words">{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
          <DetailsContent order={order} onProductOpen={onProductOpen} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailsContent({ order, onProductOpen }: { order: Order; onProductOpen?: () => void }) {
  const deliveryProvider = order.delivery.provider === "cdek" ? "СДЭК" : "Ozon";
  return (
    <div className="space-y-5">
      <ul className="space-y-4" aria-label="Состав заказа">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4 text-sm">
            <div className="min-w-0">
              <Link
                href={routes.product(item.categorySlug, item.slug)}
                onClick={onProductOpen}
                className="font-medium break-words focus-visible:underline"
              >
                {item.title}
              </Link>
              <p className="mt-1 text-muted-foreground">{item.quantity} шт.</p>
            </div>
            <span className="shrink-0 tabular-nums">{formatMoney(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-5 border-t border-border/60 pt-5 text-sm sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <h4 className="font-medium">Пункт выдачи {deliveryProvider}</h4>
          <p className="flex items-start gap-2 text-muted-foreground">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="break-words">{order.delivery.pickupPoint.address}</span>
          </p>
          {order.delivery.pickupPoint.workHours && (
            <p className="text-muted-foreground">{order.delivery.pickupPoint.workHours}</p>
          )}
        </div>
        <div className="min-w-0 space-y-1.5 break-words">
          <h4 className="font-medium">Получатель</h4>
          <p className="text-muted-foreground">{order.customer.name}</p>
          {order.customer.phone && <p className="text-muted-foreground">{order.customer.phone}</p>}
          <p className="text-muted-foreground">{order.customer.email}</p>
        </div>
      </div>
      <dl className="space-y-2 border-t border-border/60 pt-4 text-sm">
        <div className="flex justify-between gap-4 text-muted-foreground">
          <dt>Товары</dt>
          <dd className="shrink-0 tabular-nums">{formatMoney(order.subtotal)}</dd>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between gap-4 text-muted-foreground">
            <dt className="min-w-0 break-words">
              Скидка{order.promoCode ? ` · ${order.promoCode}` : ""}
            </dt>
            <dd className="shrink-0 tabular-nums">−{formatMoney(order.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 text-muted-foreground">
          <dt>Доставка</dt>
          <dd className="shrink-0 tabular-nums">
            {order.deliveryPrice === 0 ? "Бесплатно" : formatMoney(order.deliveryPrice)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 pt-1 font-medium">
          <dt>Итого</dt>
          <dd className="shrink-0 tabular-nums">{formatMoney(order.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
