"use client";

import { Check, LoaderCircle, Minus, Palette, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Product } from "@/entities/products";
import { routes } from "@/shared/constants";
import { Button, Card, CardContent, Separator } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/lib";

import { useAnalytics } from "../lib/analytics";

type PurchasePanelProps = {
  product: Product;
  onAddToCart?: (_product: Product, _quantity?: number) => Promise<void> | void;
};

export function ProductPurchase({ product, onAddToCart }: PurchasePanelProps) {
  const analytics = useAnalytics();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOutOfStock = product.isOutOfStock;

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    setSubmitError(undefined);
  }, [product.id]);

  const total = useMemo(
    () => (product.price * quantity).toLocaleString("ru-RU"),
    [product.price, quantity],
  );

  const handleAdd = async () => {
    if (!onAddToCart || isAdding || isOutOfStock) {
      return;
    }

    setIsAdding(true);
    setSubmitError(undefined);

    try {
      await onAddToCart(product, quantity);
      setAdded(true);

      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }

      resetTimer.current = setTimeout(() => setAdded(false), 1800);
    } catch {
      setSubmitError("Не удалось добавить товар в корзину. Попробуйте еще раз.");
    } finally {
      setIsAdding(false);
    }
  };

  const ActionIcon = isAdding ? LoaderCircle : added ? Check : ShoppingBag;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Количество</p>
            <p className="text-sm text-muted-foreground">
              {isOutOfStock ? "Сейчас товар нельзя добавить в корзину" : `Итого: ${total} ₽`}
            </p>
          </div>

          <div className="flex items-center rounded-lg border bg-background p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Уменьшить количество"
              disabled={isOutOfStock}
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
              disabled={isOutOfStock}
              onClick={() => setQuantity((value) => value + 1)}
            >
              <Plus />
            </Button>
          </div>
        </div>

        <Separator />

        {submitError ? (
          <p className="text-sm text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Button
            type="button"
            size="lg"
            onClick={handleAdd}
            disabled={!onAddToCart || isAdding || isOutOfStock}
            className={cn(
              "h-11",
              added
                ? "bg-emerald-500 text-white hover:bg-emerald-500 focus-visible:border-emerald-300 focus-visible:ring-emerald-400/30"
                : "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500",
            )}
          >
            <ActionIcon data-icon="inline-start" className={cn(isAdding && "animate-spin")} />
            {isOutOfStock
              ? "Нет в наличии"
              : isAdding
                ? "Добавляем"
                : added
                  ? "Добавлено"
                  : "В корзину"}
          </Button>

          <Button asChild variant="outline" size="lg" className="h-11">
            <Link href={routes.cart}>Перейти в корзину</Link>
          </Button>
        </div>

        {product.digitalCollection ? (
          <>
            <Separator />
            <Button
              asChild
              className="h-11 w-full border-rose-200 bg-rose-50/70 text-rose-950 hover:border-rose-300 hover:bg-rose-100"
              size="lg"
              variant="outline"
            >
              <Link
                aria-label={`Смотреть цифровую версию «${product.digitalCollection.title}»`}
                href={routes.digitalCollection(product.digitalCollection.slug)}
                onClick={() =>
                  analytics.digitalOpened(product.id, product.digitalCollection?.slug ?? "")
                }
              >
                <Palette data-icon="inline-start" aria-hidden="true" />
                Смотреть цифровую версию
              </Link>
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
