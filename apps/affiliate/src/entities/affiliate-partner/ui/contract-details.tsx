import { CalendarDays, FileCheck2, Landmark, ShieldCheck } from "lucide-react";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "@/shared/ui";

import { formatDate, formatKopecks } from "../lib/formatters";
import type { AffiliatePartner } from "../model/types";

export function ContractDetails({
  partner,
}: {
  readonly partner: AffiliatePartner;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-700">
              <FileCheck2 aria-hidden="true" />
            </span>
            <Badge variant="success">
              <ShieldCheck aria-hidden="true" />
              Подписан
            </Badge>
          </div>
          <CardTitle>Договор</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <DetailRow label="Номер" value={partner.contract.number} />
          <Separator />
          <DetailRow
            icon={CalendarDays}
            label="Дата подписания"
            value={formatDate(partner.contract.signedAt)}
          />
          <Separator />
          <DetailRow
            label="Минимальная сумма выплаты"
            value={formatKopecks(partner.effectiveMinimumPayoutKopecks)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-rose-100 text-rose-700">
            <Landmark aria-hidden="true" />
          </span>
          <CardTitle>Реквизиты</CardTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Чтобы изменить реквизиты, свяжитесь с менеджером.
          </p>
        </CardHeader>
        <CardContent>
          <div className="min-w-0 max-w-full whitespace-pre-wrap break-words rounded-2xl border border-border bg-muted/55 p-4 text-sm leading-7 text-foreground [overflow-wrap:anywhere]">
            {partner.contract.paymentDetails}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type DetailRowProps = {
  readonly icon?: typeof CalendarDays;
  readonly label: string;
  readonly value: string;
};

function DetailRow({ icon: Icon, label, value }: DetailRowProps) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4">
      <span className="flex min-w-0 flex-1 items-center gap-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
        {label}
      </span>
      <strong className="min-w-0 flex-1 break-words text-right text-sm [overflow-wrap:anywhere]">
        {value}
      </strong>
    </div>
  );
}
