"use client";

import { useAnalytics } from "../lib/analytics";
import { ArrowLeft } from "lucide-react";
import { withAuth } from "@/features/auth";

import type { Cart as CartModel } from "@/entities/cart";
import { useCartData } from "@/entities/cart";
import { withPromocode } from "@/features/promocode";
import { routes } from "@/shared/constants";
import { Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

import { useRemoveCartItemMutation, useUpdateCartItemQuantityMutation } from "../model";
import { useCartAuth } from "../lib/use-cart-auth";
import { getItemsWord } from "../lib/cart-format";

import { CartLine } from "./cart-line";
import { CartSummary } from "./cart-summary";
import { EmptyCartLine } from "./empty-cart-line";

function BaseCart() {
  const { onLoginRequested } = useCartAuth();
  const cart = useCartData();

  if (cart.isPending) {
    return (
      <section className="container py-10">
        <DataState title="Загружаем корзину" description="Проверяем выбранные товары и цены." />
      </section>
    );
  }

  if (cart.isError) {
    return (
      <section className="container py-10">
        <DataState
          variant="error"
          title="Не удалось загрузить корзину"
          description="Обновите страницу или попробуйте немного позже."
        />
      </section>
    );
  }

  if (!cart.data || cart.data.items.length === 0) {
    return (
      <section className="container py-8 md:py-12">
        <EmptyCartLine />
      </section>
    );
  }

  return <LoadedCart cart={cart.data} onPromocodeLoginRequested={onLoginRequested} />;
}

function BaseLoadedCart({ cart }: { cart: CartModel }) {
  const analytics = useAnalytics();
  const { mutate: updateCartItemQuantity, isPending: isUpdatingItemQuantity } =
    useUpdateCartItemQuantityMutation();
  const { mutate: removeCartItem, isPending: isRemovingItem } = useRemoveCartItemMutation();
  const isMutating = isUpdatingItemQuantity || isRemovingItem;
  const itemsLabel = `${cart.itemsCount} ${getItemsWord(cart.itemsCount)}`;

  return (
    <section className="container py-8 md:py-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <PageTitle className="text-foreground">Корзина</PageTitle>
          <p className="text-muted-foreground">{itemsLabel}</p>
        </div>

        <Button asChild variant="outline">
          <Link href={routes.catalog} onClick={analytics.continueShopping}>
            <ArrowLeft data-icon="inline-start" />
            Продолжить покупки
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <ul className="min-w-0 divide-y border-y" aria-busy={isMutating}>
          {cart.items.map((item) => (
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

        <CartSummary itemsLabel={itemsLabel} cart={cart} isMutating={isMutating} />
      </div>
    </section>
  );
}

const LoadedCart = withPromocode(BaseLoadedCart);

export const Cart = withAuth(BaseCart, { source: "cart" });
