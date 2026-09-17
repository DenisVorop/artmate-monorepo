import {
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  Landmark,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import {
  formatFinanceKopecks,
  getVisibleBalanceRows,
  type AffiliateBalance,
} from "@/entities/affiliate-finance";
import { Card, CardContent } from "@/shared/ui";
import { routes } from "@/shared/constants";

import { formatMoscowDateTime } from "../lib";

type BalanceCardProps = {
  readonly asOf: string;
  readonly balance: AffiliateBalance;
};

export function BalanceCard({ asOf, balance }: BalanceCardProps) {
  const rows = getVisibleBalanceRows(balance);

  return (
    <Card className="relative isolate min-w-0 overflow-hidden border-0 bg-ink py-0 text-white shadow-[0_24px_70px_rgb(35_22_52/18%)] ring-white/8">
      <div
        className="absolute inset-0 opacity-70 [background-image:radial-gradient(rgb(255_255_255/14%)_0.7px,transparent_0.7px)] [background-size:16px_16px] [mask-image:linear-gradient(to_bottom_right,black,transparent_72%)]"
        aria-hidden="true"
      />
      <div
        className="absolute -right-28 -bottom-36 size-96 rounded-full bg-brand-gradient opacity-60 blur-sm"
        aria-hidden="true"
      />
      <CardContent className="relative z-10 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-white/65">Доступно</p>
          <span className="grid size-10 place-items-center rounded-2xl bg-white/10 text-orange-200 ring-1 ring-white/10">
            <WalletCards aria-hidden="true" />
          </span>
        </div>
        <p className="font-heading mt-5 min-w-0 break-words text-4xl leading-none font-bold tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-5xl">
          {formatFinanceKopecks(balance.availableKopecks)}
        </p>

        <dl className="mt-8 grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div
              className="min-w-0 rounded-2xl bg-white/8 p-4 ring-1 ring-white/10"
              key={row.key}
            >
              <dt className="flex items-center gap-2 text-xs font-bold text-white/55">
                {row.key === "pending" ? (
                  <Clock3 className="size-4" aria-hidden="true" />
                ) : row.key === "reserved" ? (
                  <WalletCards className="size-4" aria-hidden="true" />
                ) : row.key === "paid" ? (
                  <Landmark className="size-4" aria-hidden="true" />
                ) : row.key === "debt" ? (
                  <ShieldAlert className="size-4" aria-hidden="true" />
                ) : (
                  <CircleDollarSign className="size-4" aria-hidden="true" />
                )}
                {row.label}
              </dt>
              <dd className="mt-2 min-w-0 break-words text-lg font-extrabold tabular-nums [overflow-wrap:anywhere]">
                {formatFinanceKopecks(row.value)}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/48">
          <p>
            Возвращено за всё время:{" "}
            {formatFinanceKopecks(balance.reversedKopecks)}
          </p>
          <p>Актуально на {formatMoscowDateTime(asOf)} МСК</p>
          <Link
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-ink transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            href={routes.payouts}
          >
            Заказать выплату
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
