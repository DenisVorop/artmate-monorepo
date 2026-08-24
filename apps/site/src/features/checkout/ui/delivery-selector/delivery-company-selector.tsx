"use client";

import { CheckCircle2 } from "lucide-react";

import { cn } from "@/shared/lib";
import { Label } from "@/shared/ui";

import { deliveryCompanies, type DeliveryCompanyCode } from "./delivery-options";

type DeliveryCompanySelectorProps = {
  isOzonDeliveryAvailable: boolean;
  onSelect: (_company: DeliveryCompanyCode) => void;
  selectedCompany?: DeliveryCompanyCode;
};

export function DeliveryCompanySelector({
  isOzonDeliveryAvailable,
  onSelect,
  selectedCompany,
}: DeliveryCompanySelectorProps) {
  return (
    <div className="space-y-2">
      <Label id="delivery-company-label">Служба доставки</Label>
      <div
        role="group"
        aria-labelledby="delivery-company-label"
        className="grid gap-2 sm:grid-cols-2"
      >
        {deliveryCompanies.map((company) => {
          const isAvailable = company.code === "cdek" || isOzonDeliveryAvailable;
          const isSelected = selectedCompany === company.code;
          const Icon = company.icon;

          return (
            <button
              key={company.code}
              type="button"
              disabled={!isAvailable}
              aria-pressed={isSelected}
              className={cn(
                "flex min-h-20 items-start gap-3 rounded-lg border bg-background p-3 text-left transition-colors outline-none",
                isAvailable &&
                  "hover:border-rose-200 hover:bg-rose-50/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                !isAvailable && "cursor-not-allowed opacity-70",
                isSelected && "border-rose-500 bg-rose-50 text-rose-950 shadow-sm",
              )}
              onClick={() => onSelect(company.code)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1",
                  company.accentClassName,
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{company.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {isAvailable ? (
                    "Пункты выдачи по РФ"
                  ) : (
                    <span>данный товар не можем доставить через озон</span>
                  )}
                </span>
              </span>
              {isSelected ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-rose-500" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
