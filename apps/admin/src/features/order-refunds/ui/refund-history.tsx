import type { OrderRefunds } from "@/entities/order-refund";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

import { formatDateTime, formatMoney } from "../lib";

export function RefundHistory({
  refunds,
}: {
  readonly refunds: OrderRefunds["refunds"];
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>История возвратов</CardTitle>
        <CardDescription>Новые операции сверху.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Возвратов пока нет.</p>
        ) : (
          <ol className="min-w-0 space-y-3">
            {refunds.map((refund) => (
              <li className="min-w-0 rounded-lg border p-3" key={refund.id}>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">Операция {refund.reference}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {refund.reason}
                    </p>
                  </div>
                  <div className="min-w-0 max-w-full break-words text-sm sm:max-w-56 sm:text-right">
                    <p className="font-medium">{formatMoney(refund.totalKopecks)}</p>
                    <p className="text-muted-foreground">{formatDateTime(refund.createdAt)}</p>
                    <p className="break-words text-muted-foreground">
                      {refund.author.name ?? "Администратор"}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 min-w-0 space-y-1 border-t pt-3 text-sm">
                  {refund.items.map((item) => (
                    <li className="flex min-w-0 justify-between gap-3" key={item.productId}>
                      <span className="min-w-0 break-words">{item.title} · {item.quantity} шт.</span>
                      <span className="shrink-0">{formatMoney(item.amountKopecks)}</span>
                    </li>
                  ))}
                  {refund.deliveryKopecks > 0 ? (
                    <li className="flex justify-between gap-3">
                      <span>Доставка</span>
                      <span>{formatMoney(refund.deliveryKopecks)}</span>
                    </li>
                  ) : null}
                  <li className="flex min-w-0 justify-between gap-3 text-muted-foreground">
                    <span className="min-w-0 break-words">Комиссия отменена</span>
                    <span className="shrink-0">{formatMoney(refund.reversedCommissionKopecks)}</span>
                  </li>
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
