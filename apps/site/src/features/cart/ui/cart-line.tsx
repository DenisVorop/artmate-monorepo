"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";

import type { CartItem } from "@/entities/cart";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
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
  const productHref = routes.product(item.categorySlug, item.slug);
  const canDecrease = item.quantity > 1 && !disabled;

  return (
    <div className="rounded-lg border bg-background p-3 sm:p-4">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <Link
          href={productHref}
          className="relative block aspect-square overflow-hidden rounded-md bg-muted"
        >
          <Image
            fill
            src={item.image}
            alt={item.title}
            sizes="(min-width: 640px) 80px, 72px"
            className="object-cover"
          />
        </Link>

        <div className="min-w-0 self-center">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {item.category}
          </p>
          <Link
            href={productHref}
            className="mt-1 block truncate font-medium text-foreground hover:text-rose-500"
          >
            {item.title}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">{formatMoney(item.price)} за штуку</p>
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
