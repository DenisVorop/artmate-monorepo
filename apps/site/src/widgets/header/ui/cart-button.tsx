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
    <Button asChild className="relative">
      <Link href={routes.cart} aria-label={cartLabel}>
        <ShoppingBag size={16} />
        <span className="hidden sm:inline">Корзина</span>
        {cartItemsCount > 0 && (
          <Badge
            aria-label={cartLabel}
            className="absolute -top-2 -right-2 h-5 min-w-5 rounded-full border-2 border-white bg-rose-500 px-1 text-[11px] leading-none text-white"
          >
            {cartItemsCount}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
