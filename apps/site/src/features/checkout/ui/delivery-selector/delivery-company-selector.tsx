"use client";

import { CheckCircle2 } from "lucide-react";

import { cn } from "@/shared/lib";
import { Badge, Label } from "@/shared/ui";

import { deliveryCompanies, type DeliveryCompanyCode } from "./delivery-options";

type DeliveryCompanySelectorProps = {
  onSelect: (_company: DeliveryCompanyCode) => void;
  selectedCompany?: DeliveryCompanyCode;
};

export function DeliveryCompanySelector({
  onSelect,
  selectedCompany,
}: DeliveryCompanySelectorProps) {
  const enabledCompanies = deliveryCompanies.filter((company) => company.isEnabled);
  const upcomingCompanies = deliveryCompanies.filter((company) => !company.isEnabled);

  return (
    <div className="space-y-2">
      <Label>Служба доставки</Label>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.85fr)]">
        <div className={cn("grid gap-2", enabledCompanies.length > 1 && "sm:grid-cols-2")}>
          {enabledCompanies.map((company) => {
            const isSelected = selectedCompany === company.code;
            const Icon = company.icon;

            return (
              <button
                key={company.code}
                type="button"
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors outline-none",
                  "hover:border-rose-200 hover:bg-rose-50/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected && "border-rose-500 bg-rose-50 text-rose-950 shadow-sm",
                )}
                onClick={() => onSelect(company.code)}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1",
                    company.accentClassName,
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{company.label}</span>
                  <span className="block text-xs text-muted-foreground">Пункты выдачи по РФ</span>
                </span>
                {isSelected ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-rose-500" />
                ) : null}
              </button>
            );
          })}
        </div>

        {upcomingCompanies.length > 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Скоро подключим</p>
              <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[11px]">
                Неактивно
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {upcomingCompanies.map((company) => {
                const Icon = company.icon;

                return (
                  <span
                    key={company.code}
                    className="inline-flex items-center gap-2 rounded-md bg-background px-2.5 py-1.5 text-sm text-muted-foreground ring-1 ring-border"
                  >
                    <Icon className="size-4" />
                    {company.label}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
