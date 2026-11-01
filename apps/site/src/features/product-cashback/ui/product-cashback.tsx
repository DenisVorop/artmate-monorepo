"use client";

import { useState } from "react";

import { LoyaltyPoints } from "@/entities/loyalty";
import type { Product } from "@/entities/products";
import { decline, cn } from "@/shared/lib";
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui";

import { useProductCashback } from "../lib/use-product-cashback";

export function ProductCashback({ product, className }: { product: Product; className?: string }) {
  const reward = useProductCashback(product);
  const [open, setOpen] = useState(false);
  if (!reward) return null;

  const pointsLabel = `${reward.points.toLocaleString("ru-RU")} ${decline(reward.points, "балл", "балла", "баллов")}`;

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="xs"
            className={cn(
              "h-7 rounded-sm bg-gradient-to-r from-rose-500 to-orange-400 px-2.5 text-sm font-bold text-white shadow-sm hover:from-rose-600 hover:to-orange-500 focus-visible:border-rose-300 focus-visible:ring-rose-400/40",
              className,
            )}
            aria-label={`Кешбэк: ${pointsLabel} за «${product.title}»`}
            onClick={(event) => {
              event.preventDefault();
              setOpen((value) => !value);
            }}
          >
            <LoyaltyPoints
              points={reward.points}
              prefix="+"
              className="flex-row-reverse"
              iconClassName="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-56">
          За покупку этого товара можно получить {pointsLabel} в клубе Artmate.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
