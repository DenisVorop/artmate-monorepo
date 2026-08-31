"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import type { Cart as CartModel } from "@/entities/cart";
import { useCartData } from "@/entities/cart";
import { withPromocode } from "@/features/promocode";
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
import { CartSummary } from "./cart-summary";
import { EmptyCartLine } from "./empty-cart-line";

export function Cart() {
  const router = useRouter();
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
          description="Проверьте, что API запущен, и попробуйте обновить страницу."
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

  return (
    <LoadedCart
      cart={cart.data}
      onPromocodeLoginRequested={() =>
        router.push(`${routes.auth}?next=${encodeURIComponent(routes.cart)}`)
      }
    />
  );
}

function BaseLoadedCart({ cart }: { cart: CartModel }) {
  const { mutate: updateCartItemQuantity, isPending: isUpdatingItemQuantity } =
    useUpdateCartItemQuantityMutation();
  const { mutate: removeCartItem, isPending: isRemovingItem } = useRemoveCartItemMutation();
  const { mutate: clearCart, isPending: isClearingCart } = useClearCartMutation();
  const isMutating = isUpdatingItemQuantity || isRemovingItem || isClearingCart;
  const itemsLabel = `${cart.itemsCount} ${getItemsWord(cart.itemsCount)}`;

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
        <ul className="space-y-4" aria-busy={isMutating}>
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

        <CartSummary
          itemsLabel={itemsLabel}
          subtotal={cart.subtotal}
          isMutating={isMutating}
          isClearingCart={isClearingCart}
          onClear={() => clearCart()}
        />
      </div>
    </section>
  );
}

const LoadedCart = withPromocode(BaseLoadedCart);
