"use client";

import { cn } from "@/shared/lib";
import { Label, RadioGroup, RadioGroupItem } from "@/shared/ui";

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
      <RadioGroup
        aria-labelledby="delivery-company-label"
        value={selectedCompany}
        onValueChange={(value) => onSelect(value as DeliveryCompanyCode)}
        className="gap-0 divide-y border-y"
      >
        {deliveryCompanies.map((company) => {
          const isAvailable = company.code === "cdek" || isOzonDeliveryAvailable;
          const isSelected = selectedCompany === company.code;
          const Icon = company.icon;

          return (
            <Label
              key={company.code}
              htmlFor={`delivery-company-${company.code}`}
              className={cn(
                "flex min-h-16 cursor-pointer items-center gap-3 py-3 font-normal",
                isAvailable && "hover:bg-muted/30",
                !isAvailable && "cursor-not-allowed opacity-70",
                isSelected && "text-foreground",
              )}
            >
              <RadioGroupItem
                id={`delivery-company-${company.code}`}
                value={company.code}
                disabled={!isAvailable}
              />
              <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
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
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
