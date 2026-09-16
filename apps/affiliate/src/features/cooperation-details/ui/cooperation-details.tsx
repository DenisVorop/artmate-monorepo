"use client";

import {
  ContractDetails,
  useAffiliatePartnerData,
} from "@/entities/affiliate-partner";
import { DataState } from "@/shared/ui";

export function CooperationDetails() {
  const { data: partner, isError, isPending } = useAffiliatePartnerData();

  if (isPending) return <DataState status="loading" />;
  if (isError || !partner) return <DataState status="error" />;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9 lg:px-10 lg:py-12">
      <header className="mb-7 max-w-3xl">
        <h1 className="font-heading mt-3 text-3xl font-bold text-balance text-ink sm:text-4xl">
          Сотрудничество
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Договор, реквизиты и минимальная сумма выплаты.
        </p>
      </header>
      <ContractDetails partner={partner} />
    </main>
  );
}
