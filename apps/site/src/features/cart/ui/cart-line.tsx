"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";

import type { CartItem } from "@/entities/cart";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { Button, Card, CardContent, CardTitle } from "@/shared/ui";
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
    <Card className="overflow-hidden py-0">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <Link
          href={productHref}
          className="relative block aspect-[3/4] overflow-hidden rounded-lg bg-muted"
        >
          <Image
            fill
            src={item.image}
            alt={item.title}
            sizes="(min-width: 640px) 112px, 35vw"
            className="object-cover"
          />
        </Link>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {item.category}
            </p>
            <CardTitle className="text-lg leading-snug">
              <Link href={productHref} className="text-foreground hover:text-rose-500">
                {item.title}
              </Link>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{formatMoney(item.price)} за штуку</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
            <div className="flex items-center rounded-lg border bg-background p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Уменьшить количество"
                disabled={!canDecrease}
                onClick={() => onUpdateQuantity(item.quantity - 1)}
              >
                <Minus />
              </Button>
              <span className="w-10 text-center text-sm font-medium" aria-live="polite">
                {item.quantity}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Увеличить количество"
                disabled={disabled || item.quantity >= 99}
                onClick={() => onUpdateQuantity(item.quantity + 1)}
              >
                <Plus />
              </Button>
            </div>

            <div className="flex min-w-28 items-center justify-end gap-2">
              <p className="text-right font-semibold">{formatMoney(item.lineTotal)}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Удалить ${item.title} из корзины`}
                disabled={disabled}
                onClick={onRemove}
                className={cn("text-muted-foreground hover:text-destructive")}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
