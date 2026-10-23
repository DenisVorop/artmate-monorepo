import { cn } from "@/shared/lib/utils";

import type { AdminOrder } from "../model/types";

type DiscountOrder = Pick<
  AdminOrder,
  "discount" | "discountBreakdown" | "promoCode" | "payment"
>;

export function OrderDiscountSummary({
  order,
  className,
}: {
  readonly order: DiscountOrder;
  readonly className?: string;
}) {
  if (!order.promoCode && order.discount === 0) return null;
  const breakdown = order.discountBreakdown;

  return (
    <div className={cn("rounded-lg border bg-muted/30 p-3 text-xs", className)}>
      <dl className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Промокод</dt>
          <dd className="min-w-0 text-right">
            {order.promoCode ? (
              <>
                <span className="block break-all font-mono font-medium">
                  {order.promoCode}
                </span>
                <span className="mt-0.5 block tabular-nums text-emerald-700 dark:text-emerald-400">
                  {breakdown
                    ? _formatDiscount(breakdown.promoDiscount)
                    : "Сумма не указана"}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Не применён</span>
            )}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">
            {order.payment.status === "paid"
              ? "Списанные баллы"
              : "Баллы в расчёте"}
          </dt>
          <dd className="min-w-0 text-right">
            {breakdown ? (
              breakdown.loyaltyPoints > 0 ? (
                <>
                  <span className="block font-medium tabular-nums">
                    {_formatPoints(breakdown.loyaltyPoints)}
                  </span>
                  <span className="mt-0.5 block tabular-nums text-emerald-700 dark:text-emerald-400">
                    {_formatDiscount(breakdown.loyaltyDiscount)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Не использованы</span>
              )
            ) : (
              <span className="text-muted-foreground">Нет данных</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t pt-3 font-semibold">
          <dt>Общая скидка</dt>
          <dd className="tabular-nums text-emerald-700 dark:text-emerald-400">
            {_formatDiscount(order.discount)}
          </dd>
        </div>
      </dl>
      {!breakdown ? (
        <p className="mt-2 text-muted-foreground">
          Разбивка скидки для этого заказа недоступна.
        </p>
      ) : null}
    </div>
  );
}

function _formatDiscount(amount: number) {
  const money = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
  return amount > 0 ? `− ${money}` : money;
}

function _formatPoints(points: number) {
  const form = new Intl.PluralRules("ru-RU").select(points);
  const word = form === "one" ? "балл" : form === "few" ? "балла" : "баллов";
  return `${points.toLocaleString("ru-RU")} ${word}`;
}
