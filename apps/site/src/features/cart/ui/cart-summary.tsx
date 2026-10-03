"use client";

import { CreditCard } from "lucide-react";

import { getPromoPricingState, PromoCodeForm, usePromocode } from "@/features/promocode";
import { DolyameCartBadge } from "@/features/dolyame-info";
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

import { formatMoney } from "../lib/cart-format";

type CartSummaryProps = {
  itemsLabel: string;
  subtotal: number;
  isMutating: boolean;
};

export function CartSummary({ itemsLabel, subtotal, isMutating }: CartSummaryProps) {
  const promoPricing = getPromoPricingState(usePromocode());
  const isTotalUnavailable = !promoPricing.isReady || isMutating;

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
        {promoPricing.preview ? (
          <div className="flex items-center justify-between gap-4 text-sm text-emerald-700">
            <span>Скидка ({promoPricing.preview.code})</span>
            <span className="font-medium">-{formatMoney(promoPricing.preview.discount)}</span>
          </div>
        ) : null}
        <Separator />
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>К оплате</span>
          {isTotalUnavailable ? (
            <AmountSkeleton className="h-6 w-24" />
          ) : (
            <span>{formatMoney(promoPricing.preview?.total ?? subtotal)}</span>
          )}
        </div>
        <DolyameCartBadge />
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <CheckoutButton disabled={isTotalUnavailable} />
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
      <Button type="button" size="lg" disabled className="h-10 w-full">
        <CreditCard data-icon="inline-start" />
        Оформить заказ
      </Button>
    );
  }

  return (
    <Button
      asChild
      size="lg"
      className="h-10 w-full border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
    >
      <CtaGradientLink href={routes.checkout}>
        <CreditCard data-icon="inline-start" />
        Оформить заказ
      </CtaGradientLink>
    </Button>
  );
}
