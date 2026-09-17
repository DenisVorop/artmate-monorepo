import {
  CircleDollarSign,
  Landmark,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";

import { formatFinanceKopecks } from "@/entities/affiliate-finance";
import type { AffiliatePayoutSummary } from "@/entities/affiliate-payout";
import { Card, CardContent } from "@/shared/ui";

const metrics = [
  { icon: CircleDollarSign, key: "availableKopecks", label: "Доступно" },
  { icon: ReceiptText, key: "reservedKopecks", label: "В заявке" },
  { icon: Landmark, key: "paidKopecks", label: "Выплачено" },
  { icon: ShieldAlert, key: "debtKopecks", label: "Задолженность" },
] as const;

export function PayoutSummary({ summary }: { summary: AffiliatePayoutSummary }) {
  return (
    <section aria-label="Сводка по выплатам">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ icon: Icon, key, label }) => (
          <Card
            className={
              key === "availableKopecks"
                ? "border-ink bg-ink text-white"
                : "bg-card/85"
            }
            key={key}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p
                  className={
                    key === "availableKopecks"
                      ? "text-sm font-bold text-white/65"
                      : "text-sm font-bold text-muted-foreground"
                  }
                >
                  {label}
                </p>
                <Icon className="size-5 opacity-65" aria-hidden="true" />
              </div>
              <p className="font-heading mt-4 min-w-0 break-words text-2xl font-bold tabular-nums [overflow-wrap:anywhere]">
                {formatFinanceKopecks(summary[key])}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Минимальная сумма одной заявки:{" "}
        <strong className="font-extrabold text-foreground">
          {formatFinanceKopecks(summary.minimumPayoutKopecks)}
        </strong>
      </p>
    </section>
  );
}
