"use client";

import { Check, LoaderCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Product } from "@/entities/products";
import { routes } from "@/shared/constants";
import { Button, Card, CardContent, Separator } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/lib";

type PurchasePanelProps = {
  product: Product;
  onAddToCart?: (_product: Product, _quantity?: number) => Promise<void> | void;
};

export function ProductPurchase({ product, onAddToCart }: PurchasePanelProps) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const total = useMemo(
    () => (product.price * quantity).toLocaleString("ru-RU"),
    [product.price, quantity],
  );

  const handleAdd = async () => {
    if (!onAddToCart || isAdding) {
      return;
    }

    setIsAdding(true);

    try {
      await onAddToCart(product, quantity);
    } finally {
      setIsAdding(false);
    }

    setAdded(true);

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }

    resetTimer.current = setTimeout(() => setAdded(false), 1800);
  };

  const ActionIcon = isAdding ? LoaderCircle : added ? Check : ShoppingBag;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Количество</p>
            <p className="text-sm text-muted-foreground">Итого: {total} ₽</p>
          </div>

          <div className="flex items-center rounded-lg border bg-background p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Уменьшить количество"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              <Minus />
            </Button>
            <span className="w-10 text-center text-sm font-medium" aria-live="polite">
              {quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Увеличить количество"
              onClick={() => setQuantity((value) => value + 1)}
            >
              <Plus />
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Button
            type="button"
            size="lg"
            onClick={handleAdd}
            disabled={!onAddToCart || isAdding}
            className={cn(
              "h-11",
              added
                ? "bg-emerald-500 text-white hover:bg-emerald-500 focus-visible:border-emerald-300 focus-visible:ring-emerald-400/30"
                : "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500",
            )}
          >
            <ActionIcon data-icon="inline-start" className={cn(isAdding && "animate-spin")} />
            {isAdding ? "Добавляем" : added ? "Добавлено" : "В корзину"}
          </Button>

          <Button asChild variant="outline" size="lg" className="h-11">
            <Link href={routes.cart}>Перейти в корзину</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
