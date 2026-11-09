"use client";

import { useState } from "react";

import { LoyaltyPoints } from "@/entities/loyalty";
import type { Product } from "@/entities/products";
import { useSession } from "@/entities/session";
import { decline, cn } from "@/shared/lib";
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui";

import { useSignedInProductCashback } from "../lib/use-product-cashback";

type ProductCashbackProps = { product: Product; className?: string };

export function ProductCashback({ product, className }: ProductCashbackProps) {
  const { user, isPending } = useSession();

  if (product.isOutOfStock || isPending) return null;
  if (user)
    return <SignedInProductCashback product={product} className={className} userId={user.id} />;

  return (
    <ProductCashbackBadge
      product={product}
      className={className}
      points={product.loyaltyRewards?.[0]?.points}
    />
  );
}

function SignedInProductCashback({
  product,
  className,
  userId,
}: ProductCashbackProps & { userId: string }) {
  const points = useSignedInProductCashback(product, userId);
  return <ProductCashbackBadge product={product} className={className} points={points} />;
}

function ProductCashbackBadge({
  product,
  className,
  points,
}: ProductCashbackProps & { points?: number }) {
  const [open, setOpen] = useState(false);
  if (points === undefined || !(points > 0)) return null;

  const pointsLabel = `${points.toLocaleString("ru-RU")} ${decline(points, "балл", "балла", "баллов")}`;

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
              points={points}
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
