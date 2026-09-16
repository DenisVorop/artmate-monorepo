"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  TicketPercent,
  WalletCards,
} from "lucide-react";

import {
  formatKopecks,
  useAffiliatePartnerData,
} from "@/entities/affiliate-partner";
import { routes } from "@/shared/constants";
import { Badge, Button, Card, CardContent, DataState } from "@/shared/ui";

export function PartnerOverview() {
  const { data: partner, isError, isPending } = useAffiliatePartnerData();

  if (isPending) return <DataState status="loading" />;
  if (isError || !partner) return <DataState status="error" />;

  const firstName = partner.userName?.trim().split(/\s+/)[0];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9 lg:px-10 lg:py-12">
      <section className="hero-surface relative overflow-hidden rounded-[2rem] p-6 text-white sm:p-9 lg:p-11">
        <div className="hero-orb hero-orb-rose" aria-hidden="true" />
        <div className="hero-orb hero-orb-orange" aria-hidden="true" />
        <div className="relative z-10 max-w-3xl">
          <Badge className="mb-7 border-white/12 bg-white/10 text-white">
            Партнёрство активно
          </Badge>
          <p className="mb-3 text-sm font-extrabold tracking-[0.15em] text-white/55 uppercase">
            Личный кабинет
          </p>
          <h1 className="font-heading min-w-0 break-words text-3xl leading-tight font-bold text-balance [overflow-wrap:anywhere] sm:text-5xl">
            {firstName
              ? `${firstName}, добро пожаловать`
              : "Добро пожаловать в Artmate"}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/68 sm:text-lg">
            Здесь собраны ваши условия сотрудничества с Artmate.
          </p>
          <Button
            asChild
            className="mt-8 bg-white text-ink hover:bg-white/90"
            size="lg"
          >
            <Link href={routes.codes}>
              Создать промокод
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      <section
        className="mt-6 grid gap-4 sm:grid-cols-3"
        aria-labelledby="today-heading"
      >
        <h2 className="sr-only" id="today-heading">
          Условия сотрудничества
        </h2>
        <InfoCard
          accent="violet"
          icon={FileText}
          label="Договор"
          value={`№ ${partner.contract.number}`}
        />
        <InfoCard
          accent="rose"
          icon={TicketPercent}
          label="Ваши промокоды"
          value="Управляйте скидкой"
        />
        <InfoCard
          accent="orange"
          icon={WalletCards}
          label="Минимальная сумма выплаты"
          value={formatKopecks(partner.effectiveMinimumPayoutKopecks)}
        />
      </section>
    </main>
  );
}

type InfoCardProps = {
  readonly accent: "orange" | "rose" | "violet";
  readonly icon: typeof FileText;
  readonly label: string;
  readonly value: string;
};

function InfoCard({ accent, icon: Icon, label, value }: InfoCardProps) {
  const color = {
    orange: "bg-orange-100 text-orange-700",
    rose: "bg-rose-100 text-rose-700",
    violet: "bg-violet-100 text-violet-700",
  }[accent];

  return (
    <Card>
      <CardContent>
        <div className={`grid size-11 place-items-center rounded-2xl ${color}`}>
          <Icon aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-bold text-muted-foreground">{label}</p>
        <p className="font-heading mt-1 min-w-0 break-words text-2xl font-bold text-ink [overflow-wrap:anywhere]">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
