"use client";

import {
  ArrowLeft,
  CreditCard,
  LoaderCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import Image from "next/image";

import { useCartData, type CartItem } from "@/entities/cart";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CtaGradientLink,
  DataState,
  Separator,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import {
  useClearCartMutation,
  useRemoveCartItemMutation,
  useUpdateCartItemQuantityMutation,
} from "../model";

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
          <h1 className="font-display text-3xl font-bold tracking-normal text-foreground md:text-4xl">
            Ваши товары
          </h1>
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

        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Итого</CardTitle>
            <CardDescription>{itemsLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Товары</span>
              {isLoading ? (
                <AmountSkeleton className="h-5 w-20" />
              ) : (
                <span className="font-medium">{formatMoney(cart.data?.subtotal ?? 0)}</span>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>К оплате</span>
              {isLoading ? (
                <AmountSkeleton className="h-6 w-24" />
              ) : (
                <span>{formatMoney(cart.data?.total ?? 0)}</span>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            <CheckoutButton disabled={isLoading || isEmpty} />
            <Button asChild variant="outline" className="w-full">
              <Link href={routes.catalog}>
                <ShoppingBag data-icon="inline-start" />
                Добавить еще товары
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || isEmpty || isMutating}
              onClick={() => clearCart()}
              className="w-full"
            >
              {isClearingCart && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
              Очистить корзину
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}

function EmptyCartLine() {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl">В корзине пока пусто</CardTitle>
          <CardDescription>
            Добавьте раскраски из каталога, чтобы оформить заказ позже.
          </CardDescription>
        </div>

        <Button
          asChild
          className="border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
        >
          <CtaGradientLink href={routes.catalog}>
            <ShoppingBag data-icon="inline-start" />
            Перейти в каталог
          </CtaGradientLink>
        </Button>
      </CardContent>
    </Card>
  );
}

function CartLineSkeleton() {
  return (
    <Card className="overflow-hidden py-0" aria-hidden="true">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div className="aspect-square rounded-lg bg-muted motion-safe:animate-pulse" />

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0 space-y-3">
            <div className="h-3 w-24 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-5 w-full max-w-sm rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted motion-safe:animate-pulse" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
            <div className="h-10 w-32 rounded-lg border bg-muted/60 motion-safe:animate-pulse" />
            <div className="h-8 w-28 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AmountSkeleton({ className }: { className: string }) {
  return <span className={cn("rounded bg-muted motion-safe:animate-pulse", className)} />;
}

function CheckoutButton({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <Button type="button" size="lg" disabled className="w-full">
        <CreditCard data-icon="inline-start" />
        Оформить заказ
      </Button>
    );
  }

  return (
    <Button asChild size="lg" className="w-full">
      <Link href={routes.checkout}>
        <CreditCard data-icon="inline-start" />
        Оформить заказ
      </Link>
    </Button>
  );
}

type CartLineProps = {
  item: CartItem;
  disabled: boolean;
  onUpdateQuantity: (_quantity: number) => void;
  onRemove: () => void;
};

function CartLine({ item, disabled, onUpdateQuantity, onRemove }: CartLineProps) {
  const productHref = routes.product(item.categorySlug, item.slug);
  const canDecrease = item.quantity > 1 && !disabled;

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <Link
          href={productHref}
          className="relative block aspect-square overflow-hidden rounded-lg bg-muted"
        >
          <Image
            fill
            src={item.image}
            alt={item.title}
            sizes="(min-width: 640px) 112px, 35vw"
            className="object-cover"
          />
        </Link>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {item.category}
            </p>
            <CardTitle className="text-lg leading-snug">
              <Link href={productHref} className="text-foreground hover:text-rose-500">
                {item.title}
              </Link>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{formatMoney(item.price)} за штуку</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
            <div className="flex items-center rounded-lg border bg-background p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Уменьшить количество"
                disabled={!canDecrease}
                onClick={() => onUpdateQuantity(item.quantity - 1)}
              >
                <Minus />
              </Button>
              <span className="w-10 text-center text-sm font-medium" aria-live="polite">
                {item.quantity}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Увеличить количество"
                disabled={disabled || item.quantity >= 99}
                onClick={() => onUpdateQuantity(item.quantity + 1)}
              >
                <Plus />
              </Button>
            </div>

            <div className="flex min-w-28 items-center justify-end gap-2">
              <p className="text-right font-semibold">{formatMoney(item.lineTotal)}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Удалить ${item.title} из корзины`}
                disabled={disabled}
                onClick={onRemove}
                className={cn("text-muted-foreground hover:text-destructive")}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function getItemsWord(count: number) {
  const lastTwoDigits = Math.abs(count) % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "товаров";
  }

  const lastDigit = Math.abs(count) % 10;

  if (lastDigit === 1) {
    return "товар";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "товара";
  }

  return "товаров";
}
