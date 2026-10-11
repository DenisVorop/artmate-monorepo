"use client";

import { ArrowRight } from "lucide-react";

import { getCartPriceBreakdown, type Cart } from "@/entities/cart";
import { getPromoPricingState, PromoCodeForm, usePromocode } from "@/features/promocode";
import { routes } from "@/shared/constants";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CtaGradientLink,
  DiscountBreakdown,
  Separator,
} from "@/shared/ui";

import { formatMoney } from "../lib/cart-format";

type CartSummaryProps = {
  cart: Cart;
  itemsLabel: string;
  isMutating: boolean;
};

export function CartSummary({ cart, itemsLabel, isMutating }: CartSummaryProps) {
  const promoPricing = getPromoPricingState(usePromocode());
  const { originalSubtotal, saleDiscount } = getCartPriceBreakdown(cart);
  const promoDiscount = promoPricing.preview?.discount ?? 0;
  const totalDiscount = (Math.round(saleDiscount * 100) + Math.round(promoDiscount * 100)) / 100;
  const isTotalUpdating = !promoPricing.isReady || isMutating;
  const discounts = [
    ...(saleDiscount > 0 ? [{ label: "Скидки на товары", amount: formatMoney(saleDiscount) }] : []),
    ...(promoDiscount > 0
      ? [{ label: `Промокод ${promoPricing.preview!.code}`, amount: formatMoney(promoDiscount) }]
      : []),
  ];

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-sm lg:sticky lg:top-[calc(var(--site-header-banner-height)+var(--site-header-nav-height)+1rem)]">
      <CardHeader className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        <CardTitle className="text-xl">Сумма заказа</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-5 sm:px-6">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span>{itemsLabel}</span>
          <span className="font-medium tabular-nums">{formatMoney(originalSubtotal)}</span>
        </div>
        <DiscountBreakdown total={formatMoney(totalDiscount)} rows={discounts} />
        <div className="pt-5" aria-live="polite" aria-busy={isTotalUpdating}>
          <div className="flex items-baseline justify-between gap-4 text-xl font-bold">
            <span>Сумма</span>
            <span className="tabular-nums">
              {formatMoney(promoPricing.preview?.total ?? cart.subtotal)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {isTotalUpdating ? "Обновляем сумму…" : "Без учёта доставки"}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2 border-0 bg-transparent px-5 pt-4 pb-5 sm:px-6">
        <CheckoutButton disabled={isTotalUpdating} />
        <p className="text-center text-xs leading-5 text-muted-foreground">
          Доставку выберете на следующем шаге
        </p>
      </CardFooter>
      <Separator />
      <div className="px-5 py-2 sm:px-6">
        <PromoCodeForm />
      </div>
    </Card>
  );
}

function CheckoutButton({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <Button type="button" size="lg" disabled className="min-h-12 w-full rounded-xl">
        К оформлению
        <ArrowRight data-icon="inline-end" />
      </Button>
    );
  }

  return (
    <Button
      asChild
      size="lg"
      className="min-h-12 w-full rounded-xl border-0 bg-gradient-to-r from-rose-500 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500"
    >
      <CtaGradientLink href={routes.checkout}>
        К оформлению
        <ArrowRight data-icon="inline-end" />
      </CtaGradientLink>
    </Button>
  );
}
