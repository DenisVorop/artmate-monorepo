import {
  formatKopecks,
  type AffiliatePartnerAnalytics,
} from "@/entities/affiliate-partners";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import { formatMoscowDateTime } from "../lib";

export function FinanceBalance({
  asOf,
  balance,
}: {
  readonly asOf: string;
  readonly balance: AffiliatePartnerAnalytics["balance"];
}) {
  return (
    <Card
      className="relative min-w-0 overflow-hidden border-0 bg-zinc-950 text-white ring-0"
      size="sm"
    >
      <div className="pointer-events-none absolute -right-12 -top-16 size-40 rounded-full bg-fuchsia-600/30 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 size-40 rounded-full bg-orange-500/20 blur-2xl" />
      <CardHeader className="relative min-w-0">
        <CardTitle className="text-zinc-300">Доступно</CardTitle>
        <p className="min-w-0 break-words font-heading text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
          {formatKopecks(balance.availableKopecks)}
        </p>
      </CardHeader>
      <CardContent className="relative min-w-0">
        <dl className="grid min-w-0 grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <BalanceValue label="В заявке" value={balance.reservedKopecks} />
          <BalanceValue label="Выплачено" value={balance.paidKopecks} />
          <BalanceValue label="Задолженность" value={balance.debtKopecks} />
          <BalanceValue label="Ожидает" value={balance.pendingKopecks} />
          <BalanceValue label="Удержано" value={balance.heldKopecks} />
          <BalanceValue label="Возвращено" value={balance.reversedKopecks} />
        </dl>
        <p className="mt-3 text-[11px] text-zinc-400">
          На {formatMoscowDateTime(asOf)}
        </p>
      </CardContent>
    </Card>
  );
}

function BalanceValue({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="min-w-0 rounded-md bg-white/7 px-2.5 py-2">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="mt-0.5 break-words font-medium tabular-nums">
        {formatKopecks(value)}
      </dd>
    </div>
  );
}
