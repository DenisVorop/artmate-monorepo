import {
  BadgeRussianRuble,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";

import {
  formatFinanceKopecks,
  formatOrderCount,
  formatSignedFinanceKopecks,
  type AffiliateMetrics,
} from "@/entities/affiliate-finance";
import { Card, CardContent } from "@/shared/ui";

export function MetricCards({ totals }: { readonly totals: AffiliateMetrics }) {
  const metrics = [
    {
      accent: "bg-violet-100 text-violet-700",
      icon: ShoppingBag,
      label: "Оплачено заказов",
      value: formatOrderCount(totals.orderCount),
    },
    {
      accent: "bg-orange-100 text-orange-700",
      help: "До скидки, без доставки. Возвраты не уменьшают продажи.",
      icon: ReceiptText,
      label: "Продажи",
      value: formatFinanceKopecks(totals.salesKopecks),
    },
    {
      accent: "bg-rose-100 text-rose-700",
      icon: BadgeRussianRuble,
      label: "Начислено",
      value: formatFinanceKopecks(totals.earnedKopecks),
    },
    {
      accent: "bg-red-100 text-red-700",
      icon: RotateCcw,
      label: "Возвраты",
      value: formatFinanceKopecks(totals.reversedKopecks),
    },
  ];

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <Card className="sm:col-span-2">
        <CardContent className="flex min-w-0 items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-muted-foreground">
              Чистый доход
            </p>
            <p className="font-heading mt-1 min-w-0 break-words text-3xl font-bold tabular-nums [overflow-wrap:anywhere]">
              {formatSignedFinanceKopecks(totals.netKopecks)}
            </p>
          </div>
          <div
            className="h-12 w-1.5 shrink-0 rounded-full bg-brand-gradient"
            aria-hidden="true"
          />
        </CardContent>
      </Card>
      {metrics.map(({ accent, help, icon: Icon, label, value }) => (
        <Card className="gap-3" key={label}>
          <CardContent>
            <div
              className={`grid size-9 place-items-center rounded-xl ${accent}`}
            >
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <p className="mt-4 text-xs font-bold text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 min-w-0 break-words text-lg font-extrabold tabular-nums [overflow-wrap:anywhere]">
              {value}
            </p>
            {help ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {help}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
