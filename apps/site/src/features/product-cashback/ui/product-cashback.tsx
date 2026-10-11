"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { LoyaltyPoints } from "@/entities/loyalty";
import type { Product } from "@/entities/products";
import { decline, cn } from "@/shared/lib";
import {
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui";

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
          <Badge
            asChild
            variant="secondary"
            className="border-emerald-100 bg-emerald-50 text-emerald-800"
          >
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className={cn(
                "h-6 gap-1.5 px-2 hover:bg-emerald-100 hover:text-emerald-900",
                className,
              )}
              aria-label={`О кешбэке за «${product.title}»`}
              onClick={(event) => {
                event.preventDefault();
                setOpen((value) => !value);
              }}
            >
              Кешбэк
              <LoyaltyPoints points={reward.points} prefix="+" iconClassName="size-3.5" />
              <Info className="size-3 opacity-60" aria-hidden="true" />
            </Button>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-56">
          За покупку этого товара можно получить {pointsLabel} в клубе Artmate.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
