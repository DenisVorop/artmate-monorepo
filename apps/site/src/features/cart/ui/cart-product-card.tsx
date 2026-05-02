"use client";

import { Check, LoaderCircle, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { ProductCard, type Product } from "@/entities/products";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";

type CartProductCardProps = {
  readonly eagerImage?: boolean;
  readonly onAddToCart?: (_product: Product, _quantity?: number) => Promise<void> | void;
  readonly product: Product;
};

export function CartProductCard({
  eagerImage = false,
  onAddToCart,
  product,
}: CartProductCardProps) {
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

  const handleAdd = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!onAddToCart || isAdding) {
      return;
    }

    setIsAdding(true);

    try {
      await onAddToCart(product, 1);
    } finally {
      setIsAdding(false);
    }

    setAdded(true);

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }

    resetTimer.current = setTimeout(() => setAdded(false), 1800);
  };

  const addButtonLabel = isAdding ? "Добавляем" : added ? "Добавлено" : "В корзину";
  const AddIcon = isAdding ? LoaderCircle : added ? Check : ShoppingBag;
  const addButtonClassName = added
    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 focus-visible:border-emerald-300 focus-visible:ring-emerald-400/30"
    : "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500 hover:shadow-rose-500/30 focus-visible:border-rose-300 focus-visible:ring-rose-400/30";

  return (
    <ProductCard
      eagerImage={eagerImage}
      product={product}
      mediaAction={
        <Button
          className={cn("pointer-events-auto w-full", addButtonClassName)}
          disabled={!onAddToCart || isAdding}
          onClick={handleAdd}
          size="lg"
          type="button"
        >
          <AddIcon data-icon="inline-start" className={cn(isAdding && "animate-spin")} />
          {addButtonLabel}
        </Button>
      }
      footerAction={
        <Button
          aria-label={
            isAdding
              ? `Добавляем ${product.title} в\u00a0корзину`
              : added
                ? "Добавлено в\u00a0корзину"
                : `Добавить ${product.title} в\u00a0корзину`
          }
          className={cn("md:hidden", addButtonClassName)}
          disabled={!onAddToCart || isAdding}
          onClick={handleAdd}
          size="icon-lg"
          type="button"
        >
          <AddIcon className={cn(isAdding && "animate-spin")} />
        </Button>
      }
    />
  );
}
