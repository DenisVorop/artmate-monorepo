"use client";

import { LoaderCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import type { MouseEvent, MouseEventHandler } from "react";
import { useState } from "react";

import { useCartData } from "@/entities/cart";
import { ProductCard, type Product } from "@/entities/products";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";

import {
  useAddCartItemMutation,
  useRemoveCartItemMutation,
  useUpdateCartItemQuantityMutation,
} from "../model";
import { useAnalytics, type ProductListPlacement } from "../lib/analytics";

const maxCartItemQuantity = 99;

type CartProductCardProps = {
  readonly eagerImage?: boolean;
  readonly list: ProductListPlacement;
  readonly position?: number;
  readonly product: Product;
};

type CartQuantityControlsProps = {
  readonly className?: string;
  readonly disabled: boolean;
  readonly onDecrease: MouseEventHandler<HTMLButtonElement>;
  readonly onIncrease: MouseEventHandler<HTMLButtonElement>;
  readonly productTitle: string;
  readonly quantity: number;
};

export function CartProductCard({
  eagerImage = false,
  list,
  position,
  product,
}: CartProductCardProps) {
  const [addErrorLabel, setAddErrorLabel] = useState<string>();
  const cart = useCartData();
  const analytics = useAnalytics();
  const { mutate: addCartItem, isPending: isAdding } = useAddCartItemMutation();
  const { mutate: updateCartItemQuantity, isPending: isUpdatingQuantity } =
    useUpdateCartItemQuantityMutation();
  const { mutate: removeCartItem, isPending: isRemovingItem } = useRemoveCartItemMutation();
  const cartItem = cart.data?.items.find((item) => item.id === product.id);
  const quantity = cartItem?.quantity ?? 0;
  const isInCart = quantity > 0;
  const isMutating = isAdding || isUpdatingQuantity || isRemovingItem;
  const isOutOfStock = product.isOutOfStock;
  const handleProductOpen = () => analytics.productClicked(product, { list, position });

  const handleAdd = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isMutating || isOutOfStock) {
      return;
    }

    try {
      await addCartItem({ productId: product.id, quantity: 1 });
      setAddErrorLabel(undefined);
    } catch {
      setAddErrorLabel("Не удалось добавить");
    }
  };

  const handleDecrease = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isInCart || isMutating) {
      return;
    }

    if (quantity <= 1) {
      removeCartItem({ productId: product.id });
      return;
    }

    updateCartItemQuantity({ productId: product.id, quantity: quantity - 1 });
  };

  const handleIncrease = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isInCart || isMutating || quantity >= maxCartItemQuantity) {
      return;
    }

    updateCartItemQuantity({ productId: product.id, quantity: quantity + 1 });
  };

  const addButtonLabel = addErrorLabel ?? (isAdding ? "Добавляем" : "В корзину");
  const AddIcon = isAdding ? LoaderCircle : ShoppingBag;
  const addButtonClassName =
    "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500 hover:shadow-rose-500/30 focus-visible:border-rose-300 focus-visible:ring-rose-400/30";
  const renderCartAction = () => {
    if (isOutOfStock) {
      return (
        <Button
          className="pointer-events-auto w-full"
          disabled
          size="lg"
          type="button"
          variant="secondary"
        >
          Нет в наличии
        </Button>
      );
    }

    return isInCart ? (
      <CartQuantityControls
        disabled={isMutating}
        onDecrease={handleDecrease}
        onIncrease={handleIncrease}
        productTitle={product.title}
        quantity={quantity}
      />
    ) : (
      <Button
        className={cn("pointer-events-auto w-full", addButtonClassName)}
        disabled={isMutating}
        onClick={handleAdd}
        size="lg"
        type="button"
      >
        <AddIcon data-icon="inline-start" className={cn(isAdding && "animate-spin")} />
        {addButtonLabel}
      </Button>
    );
  };

  return (
    <ProductCard
      eagerImage={eagerImage}
      footerAction={<div className="w-[min(9.75rem,58%)] md:hidden">{renderCartAction()}</div>}
      product={product}
      mediaAction={renderCartAction()}
      mediaActionViewport="desktop"
      mediaActionVisibility={isInCart ? "always" : "hover"}
      onOpen={handleProductOpen}
    />
  );
}

function CartQuantityControls({
  className,
  disabled,
  onDecrease,
  onIncrease,
  productTitle,
  quantity,
}: CartQuantityControlsProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto grid h-9 w-full grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center rounded-lg border border-white/70 bg-white/95 p-1 shadow-lg backdrop-blur",
        className,
      )}
      aria-label={`${productTitle}: ${quantity} в\u00a0корзине`}
    >
      <Button
        aria-label={
          quantity <= 1 ? `Убрать ${productTitle} из\u00a0корзины` : "Уменьшить количество"
        }
        className="size-7 text-stone-700 hover:bg-rose-50 hover:text-rose-600"
        disabled={disabled}
        onClick={onDecrease}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Minus />
      </Button>
      <span className="text-center text-sm font-semibold text-stone-900" aria-live="polite">
        {quantity} в корзине
      </span>
      <Button
        aria-label="Увеличить количество"
        className="size-7 text-stone-700 hover:bg-rose-50 hover:text-rose-600"
        disabled={disabled || quantity >= maxCartItemQuantity}
        onClick={onIncrease}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Plus />
      </Button>
    </div>
  );
}
