import type { OrderRefunds } from "@/entities/order-refund";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

import { formatDateTime, formatMoney } from "../lib";

export function CommissionSummary({
  commission,
}: {
  readonly commission: NonNullable<OrderRefunds["commission"]>;
}) {
  const statusLabels = {
    pending: "Ожидает доступности",
    available: "Доступна",
    held: "Удержана",
    reversed: "Полностью отменена",
    not_earned: "Не начислена",
  };

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <CardTitle>Партнерская комиссия</CardTitle>
          <Badge variant="outline">{statusLabels[commission.status]}</Badge>
        </div>
        <CardDescription className="break-words">
          Партнеру {commission.partnerPercent}%, покупателю {commission.buyerPercent}%
          {commission.isSelfPurchase ? " · собственная покупка" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-2 text-sm sm:grid-cols-3">
        <MoneyMetric label="Начислено" value={commission.earnedKopecks} />
        <MoneyMetric label="Отменено" value={commission.reversedKopecks} />
        <MoneyMetric label="Осталось" value={commission.remainingKopecks} />
        {commission.availableAt ? (
          <p className="break-words text-muted-foreground sm:col-span-3">
            Дата доступности: {formatDateTime(commission.availableAt)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MoneyMetric({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/30 p-3">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{formatMoney(value)}</p>
    </div>
  );
}
