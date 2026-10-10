"use client";

import { useCartData } from "@/entities/cart";
import { routes } from "@/shared/constants";
import { decline } from "@/shared/lib";
import { Badge, Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { ShoppingBag } from "lucide-react";

export function CartButton() {
  const { data } = useCartData();
  const cartItemsCount = data?.itemsCount ?? 0;
  const cartLabel =
    cartItemsCount > 0
      ? `${cartItemsCount} ${decline(cartItemsCount, "товар", "товара", "товаров")} в\u00a0корзине`
      : "Корзина пуста";

  return (
    <Button
      asChild
      variant="ghost"
      size="icon-lg"
      className="relative size-11 rounded-full text-stone-900 hover:bg-stone-100"
    >
      <Link href={routes.cart} aria-label={cartLabel}>
        <ShoppingBag aria-hidden="true" className="size-5" strokeWidth={1.5} />
        {cartItemsCount > 0 && (
          <Badge
            aria-label={cartLabel}
            className="absolute top-0 right-0 h-4 min-w-4 rounded-full border-2 border-white bg-rose-600 px-0.5 text-[9px] leading-none text-white"
          >
            {cartItemsCount}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
