"use client";

import { ArrowLeft } from "lucide-react";

import { useCartData } from "@/entities/cart";
import { routes } from "@/shared/constants";
import { Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

import {
  useClearCartMutation,
  useRemoveCartItemMutation,
  useUpdateCartItemQuantityMutation,
} from "../model";
import { getItemsWord } from "../lib/cart-format";

import { CartLine } from "./cart-line";
import { CartLineSkeleton } from "./cart-line-skeleton";
import { CartSummary } from "./cart-summary";
import { EmptyCartLine } from "./empty-cart-line";

export function Cart() {
  const cart = useCartData();
  const { mutate: updateCartItemQuantity, isPending: isUpdatingItemQuantity } =
    useUpdateCartItemQuantityMutation();
  const { mutate: removeCartItem, isPending: isRemovingItem } = useRemoveCartItemMutation();
  const { mutate: clearCart, isPending: isClearingCart } = useClearCartMutation();
  const isLoading = cart.isPending;
  const isMutating = isUpdatingItemQuantity || isRemovingItem || isClearingCart;

  if (cart.isError) {
    return (
      <section className="container py-10">
        <DataState
          variant="error"
          title="Не удалось загрузить корзину"
          description="Проверьте, что API запущен, и попробуйте обновить страницу."
        />
      </section>
    );
  }

  const isEmpty = !isLoading && (!cart.data || cart.data.items.length === 0);

  const itemsLabel = cart.data
    ? `${cart.data.itemsCount} ${getItemsWord(cart.data.itemsCount)}`
    : "Проверяем товары";

  return (
    <section className="container py-8 md:py-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-rose-500 uppercase">Корзина</p>
          <PageTitle className="text-foreground">Ваши товары</PageTitle>
          <p className="text-muted-foreground">{itemsLabel} в корзине Artmate.</p>
        </div>

        <Button asChild variant="outline">
          <Link href={routes.catalog}>
            <ArrowLeft data-icon="inline-start" />
            Продолжить покупки
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <ul className="space-y-4" aria-busy={isLoading}>
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <li key={index}>
                <CartLineSkeleton />
              </li>
            ))}

          {isEmpty && (
            <li>
              <EmptyCartLine />
            </li>
          )}

          {!isLoading &&
            !isEmpty &&
            cart.data?.items.map((item) => (
              <li key={item.id}>
                <CartLine
                  item={item}
                  disabled={isMutating}
                  onUpdateQuantity={(quantity) =>
                    updateCartItemQuantity({ productId: item.id, quantity })
                  }
                  onRemove={() => removeCartItem({ productId: item.id })}
                />
              </li>
            ))}
        </ul>

        <CartSummary
          itemsLabel={itemsLabel}
          subtotal={cart.data?.subtotal ?? 0}
          total={cart.data?.total ?? 0}
          isLoading={isLoading}
          isEmpty={isEmpty}
          isMutating={isMutating}
          isClearingCart={isClearingCart}
          onClear={() => clearCart()}
        />
      </div>
    </section>
  );
}
