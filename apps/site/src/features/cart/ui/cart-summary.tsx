"use client";

import { CreditCard, LoaderCircle, ShoppingBag } from "lucide-react";

import { PromoCodeForm, usePromocode } from "@/features/promocode";
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
  Separator,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { formatMoney } from "../lib/cart-format";

type CartSummaryProps = {
  itemsLabel: string;
  subtotal: number;
  isMutating: boolean;
  isClearingCart: boolean;
  onClear: () => void;
};

export function CartSummary({
  itemsLabel,
  subtotal,
  isMutating,
  isClearingCart,
  onClear,
}: CartSummaryProps) {
  const {
    isError: isPromoError,
    isHydrating,
    isPending: isPromoPending,
    preview,
    selectedCode,
  } = usePromocode();
  const isPromoUnavailable = Boolean(selectedCode) && (isPromoError || !preview);
  const isTotalUnavailable = isHydrating || isPromoPending || isPromoUnavailable || isMutating;

  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader>
        <CardTitle>Итого</CardTitle>
        <CardDescription>{itemsLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PromoCodeForm />
        <Separator />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Товары</span>
          <span className="font-medium">{formatMoney(subtotal)}</span>
        </div>
        {preview && !isPromoPending ? (
          <div className="flex items-center justify-between gap-4 text-sm text-emerald-700">
            <span>Скидка ({preview.code})</span>
            <span className="font-medium">-{formatMoney(preview.discount)}</span>
          </div>
        ) : null}
        <Separator />
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>К оплате</span>
          {isPromoUnavailable && !isPromoPending ? (
            <span className="text-sm text-destructive">Недоступно</span>
          ) : isTotalUnavailable ? (
            <AmountSkeleton className="h-6 w-24" />
          ) : (
            <span>{formatMoney(preview?.total ?? subtotal)}</span>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <p className="mb-1 text-center text-xs leading-5 text-muted-foreground">
          Службу доставки и ПВЗ СДЭК или Ozon выберете на следующем шаге. Доступность Ozon зависит
          от товаров в корзине.
        </p>
        <CheckoutButton disabled={isTotalUnavailable} />
        <Button asChild variant="outline" className="w-full">
          <Link href={routes.catalog}>
            <ShoppingBag data-icon="inline-start" />
            Добавить еще товары
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isMutating}
          onClick={onClear}
          className="w-full"
        >
          {isClearingCart && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
          Очистить корзину
        </Button>
      </CardFooter>
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
    <Button
      asChild
      size="lg"
      className="h-9 w-full border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
    >
      <CtaGradientLink href={routes.checkout}>
        <CreditCard data-icon="inline-start" />
        Оформить заказ
      </CtaGradientLink>
    </Button>
  );
}
