"use client";

import { CreditCard, LoaderCircle, ShoppingBag } from "lucide-react";

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
  total: number;
  isLoading: boolean;
  isEmpty: boolean;
  isMutating: boolean;
  isClearingCart: boolean;
  onClear: () => void;
};

export function CartSummary({
  itemsLabel,
  subtotal,
  total,
  isLoading,
  isEmpty,
  isMutating,
  isClearingCart,
  onClear,
}: CartSummaryProps) {
  return (
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
            <span className="font-medium">{formatMoney(subtotal)}</span>
          )}
        </div>
        <Separator />
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>К оплате</span>
          {isLoading ? <AmountSkeleton className="h-6 w-24" /> : <span>{formatMoney(total)}</span>}
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
