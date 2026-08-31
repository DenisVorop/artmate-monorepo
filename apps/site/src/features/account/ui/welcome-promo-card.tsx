"use client";

import { useState } from "react";
import { Check, Copy, Gift } from "lucide-react";

import { useWelcomePromo, type WelcomePromo } from "@/entities/promocode";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

type WelcomePromoCardProps = {
  isTelegramLinked: boolean;
  userId: string;
};

export function WelcomePromoCard({ isTelegramLinked, userId }: WelcomePromoCardProps) {
  const welcomePromo = useWelcomePromo({
    enabled: Boolean(userId) && isTelegramLinked,
    userId,
  });
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const promo = welcomePromo.data?.promo;

  if (!promo) {
    return null;
  }

  const discount = getDiscountLabel(promo);
  if (!discount) {
    return null;
  }

  const promoCode = promo.code;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(promoCode);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <Card className="min-w-0 overflow-hidden border-rose-200 bg-rose-50/40">
      <CardHeader className="min-w-0 gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Gift className="size-5 shrink-0 text-rose-500" />
          <CardTitle>Подарок за знакомство</CardTitle>
          <Badge variant="secondary">{discount}</Badge>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3">
        <p className="text-sm text-muted-foreground">
          Используйте промокод при оформлении заказа. Доступен один раз на аккаунт.
        </p>
        <div className="grid min-w-0 gap-2">
          <code className="min-w-0 break-all rounded-lg border bg-background px-3 py-2 text-center font-semibold tracking-wide">
            {promoCode}
          </code>
          <Button
            type="button"
            variant="outline"
            className="w-full min-w-0"
            aria-label={`Скопировать промокод ${promoCode}`}
            onClick={handleCopy}
          >
            {copyState === "copied" ? <Check /> : <Copy />}
            {copyState === "copied" ? "Скопировано" : "Скопировать"}
          </Button>
        </div>
        {copyState === "error" ? (
          <p role="status" className="text-sm text-destructive">
            Не удалось скопировать. Выделите код вручную.
          </p>
        ) : null}
        {promo.minSubtotal > 0 || promo.maxDiscount !== null || promo.endsAt ? (
          <p className="text-xs text-muted-foreground">{getConditions(promo).join(" · ")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function getDiscountLabel(promo: WelcomePromo) {
  if (promo.discountPercent !== null) {
    return `Скидка ${promo.discountPercent}%`;
  }

  if (promo.amount !== null) {
    return `Скидка ${formatRubles(promo.amount)}`;
  }

  return undefined;
}

function getConditions(promo: WelcomePromo) {
  const conditions: string[] = [];

  if (promo.minSubtotal > 0) {
    conditions.push(`Сумма товаров от ${formatRubles(promo.minSubtotal)}`);
  }

  if (promo.maxDiscount !== null) {
    conditions.push(`Скидка до ${formatRubles(promo.maxDiscount)}`);
  }

  if (promo.endsAt) {
    conditions.push(
      `До ${new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Moscow",
      }).format(new Date(promo.endsAt))} МСК`,
    );
  }

  return conditions;
}

function formatRubles(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
