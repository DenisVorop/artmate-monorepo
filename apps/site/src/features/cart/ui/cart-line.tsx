"use client";

import { useAnalytics } from "../lib/analytics";
import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";

import type { CartItem } from "@/entities/cart";
import { ProductPrice } from "@/entities/products";
import { routes } from "@/shared/constants";
import { cn, shouldBypassNextImageOptimization } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { formatMoney } from "../lib/cart-format";

type CartLineProps = {
  item: CartItem;
  disabled: boolean;
  onUpdateQuantity: (_quantity: number) => void;
  onRemove: () => void;
};

export function CartLine({ item, disabled, onUpdateQuantity, onRemove }: CartLineProps) {
  const analytics = useAnalytics();
  const productHref = routes.product(item.categorySlug, item.slug);
  const canDecrease = item.quantity > 1 && !disabled;

  return (
    <div className="bg-background py-5">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <Link
          href={productHref}
          onClick={() => analytics.productOpened(item.id)}
          className="relative block aspect-[3/4] overflow-hidden rounded-md bg-muted"
        >
          <Image
            fill
            src={item.image}
            alt={item.title}
            unoptimized={shouldBypassNextImageOptimization(item.image)}
            sizes="(min-width: 640px) 80px, 72px"
            className="object-contain"
          />
        </Link>

        <div className="min-w-0 self-center">
          {item.category && (
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {item.category}
            </p>
          )}
          <Link
            href={productHref}
            onClick={() => analytics.productOpened(item.id)}
            className="mt-1 line-clamp-2 font-semibold text-foreground hover:text-rose-500"
          >
            {item.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
            <ProductPrice price={item.price} originalPrice={item.originalPrice} />
            <span className="text-xs text-muted-foreground">за штуку</span>
          </div>
        </div>

        <div className="col-span-2 flex items-center justify-between gap-3 border-t pt-3 sm:col-span-1 sm:border-t-0 sm:pt-0">
          <div className="flex items-center rounded-md border bg-background p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Уменьшить количество"
              disabled={!canDecrease}
              onClick={() => onUpdateQuantity(item.quantity - 1)}
            >
              <Minus />
            </Button>
            <span className="w-8 text-center text-sm font-medium" aria-live="polite">
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Увеличить количество"
              disabled={disabled || item.quantity >= 99}
              onClick={() => onUpdateQuantity(item.quantity + 1)}
            >
              <Plus />
            </Button>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            <p className="text-right font-semibold whitespace-nowrap">
              {formatMoney(item.lineTotal)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Удалить ${item.title} из корзины`}
              disabled={disabled}
              onClick={onRemove}
              className={cn("shrink-0 text-muted-foreground hover:text-destructive")}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
