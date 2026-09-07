"use client";

import { AlertCircle, Headphones, RefreshCw, ShoppingBag } from "lucide-react";

import { routes } from "@/shared/constants";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { usePaymentRecovery } from "../model";

type GuestCheckoutFailureProps = {
  orderId?: string;
};

export function GuestCheckoutFailure({ orderId }: GuestCheckoutFailureProps) {
  const { error, hasResult, isPending, recoverPayment, redirectUrl } = usePaymentRecovery({
    onSuccess: (nextUrl) => {
      if (nextUrl && isSafeRecoveryRedirect(nextUrl)) {
        window.location.assign(nextUrl);
      }
    },
  });
  const canRetry = Boolean(orderId) && !isPending;
  const description = error
    ? "Не удалось проверить оплату. Попробуйте ещё раз позже или обратитесь в поддержку."
    : hasResult && !redirectUrl
      ? "Статус пока не изменился. Проверьте оплату позже или обратитесь в поддержку."
      : "Проверьте статус, чтобы продолжить оплату или вернуться к оформлению.";
  return (
    <section className="container py-10 md:py-14">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="items-start gap-4 border-b">
          <span className="flex size-12 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-200">
            <AlertCircle className="size-6" />
          </span>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Проверьте оплату</CardTitle>
            <CardDescription className="text-base leading-6">
              {description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button
            disabled={!canRetry}
            onClick={() => orderId && recoverPayment(orderId)}
            size="lg"
          >
            <RefreshCw className={isPending ? "animate-spin" : undefined} data-icon="inline-start" />
            {isPending
              ? "Проверяем оплату..."
              : hasResult && redirectUrl
                ? "Продолжить оплату"
                : "Проверить оплату"}
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={routes.catalog}>
              <ShoppingBag data-icon="inline-start" />
              Вернуться в каталог
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href={routes.contacts}>
              <Headphones data-icon="inline-start" />
              Связаться с поддержкой
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function isSafeRecoveryRedirect(value: string) {
  if (value === routes.checkout || value === routes.checkoutSuccess) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
