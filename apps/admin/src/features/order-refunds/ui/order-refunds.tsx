"use client";

import { useOrderRefundsData } from "@/entities/order-refund";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import { formatMoney } from "../lib";
import { CommissionSummary } from "./commission-summary";
import { RefundDialog } from "./refund-dialog";
import { RefundHistory } from "./refund-history";

type OrderRefundsProps = { readonly orderId: string };

export function OrderRefunds({ orderId }: OrderRefundsProps) {
  const { data, isError, isPending, refetch } = useOrderRefundsData(orderId);

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Возвраты</CardTitle>
          <CardDescription>Загружаем данные возвратов.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить возвраты</CardTitle>
          <CardDescription>
            Проверьте соединение и повторите попытку.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void refetch()}>
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="min-w-0 space-y-4" aria-labelledby="order-refunds-heading">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle id="order-refunds-heading">Возвраты</CardTitle>
            <CardDescription className="mt-1 break-words">
              Уже возвращено покупателю: {formatMoney(data.totalRefundedKopecks)}
            </CardDescription>
          </div>
          <RefundDialog data={data} />
        </CardHeader>
        {data.blockedReason ? (
          <CardContent>
            <p className="break-words rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {data.blockedReason}
            </p>
          </CardContent>
        ) : null}
      </Card>

      {data.commission ? <CommissionSummary commission={data.commission} /> : null}
      <RefundHistory refunds={data.refunds} />
    </section>
  );
}
