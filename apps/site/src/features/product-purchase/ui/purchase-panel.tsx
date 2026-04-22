"use client";

import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Product } from "@/entities/products";
import { Button, Card, CardContent, Separator, cn } from "@/shared";

type PurchasePanelProps = {
  product: Product;
};

export function ProductPurchase({ product }: PurchasePanelProps) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
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

  const handleAdd = () => {
    setAdded(true);

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }

    resetTimer.current = setTimeout(() => setAdded(false), 1800);
  };

  const ActionIcon = added ? Check : ShoppingBag;

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
            className={cn(
              "h-11",
              added
                ? "bg-emerald-500 text-white hover:bg-emerald-500 focus-visible:border-emerald-300 focus-visible:ring-emerald-400/30"
                : "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500",
            )}
          >
            <ActionIcon data-icon="inline-start" />
            {added ? "Добавлено" : "В корзину"}
          </Button>

          <Button type="button" variant="outline" size="lg" className="h-11" onClick={handleAdd}>
            Купить сейчас
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
