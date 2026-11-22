"use client";

import { useAnalytics } from "../lib/analytics";
import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/lib";
import { Label, RadioGroup, RadioGroupItem } from "@/shared/ui";

import {
  createDeliveryPickerDrafts,
  formatEstimatedDeliveryDateRange,
  formatMoney,
  getDeliveryDraftCandidate,
  isSameDeliverySelection,
  seedDeliveryPickerDrafts,
  useCheckout,
} from "../lib";

import {
  DeliveryPicker,
  deliveryCompanies,
  type DeliveryCompanyCode,
} from "@/widgets/pickup-point-picker";

type DeliveryMethodFieldProps = {
  isOzonDeliveryAvailable: boolean;
  minimumDeliveryPrices: {
    ozon: number;
  };
};

export function DeliveryMethodField({
  isOzonDeliveryAvailable,
  minimumDeliveryPrices,
}: DeliveryMethodFieldProps) {
  const analytics = useAnalytics();
  const {
    checkoutCalculation,
    confirmDelivery,
    invalidateDeliveryConfirmation,
    selectedDelivery,
    isDeliveryPickerOpen: isPickerOpen,
    setDeliveryPickerOpen: setIsPickerOpen,
  } = useCheckout();
  const [pickerCompany, setPickerCompany] = useState<DeliveryCompanyCode>("ozon");
  const [drafts, setDrafts] = useState(() => createDeliveryPickerDrafts(selectedDelivery));
  const [confirmationError, setConfirmationError] = useState<string>();
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmationRequestRef = useRef(0);
  const calculation =
    checkoutCalculation.status === "ready" ? checkoutCalculation.calculation : undefined;
  const selectedAddress = calculation?.delivery.pickupPoint.address;
  const estimatedDeliveryDate = calculation?.estimatedDeliveryDateRange
    ? formatEstimatedDeliveryDateRange(calculation.estimatedDeliveryDateRange)
    : undefined;
  const candidate = getDeliveryDraftCandidate(drafts, pickerCompany);

  useEffect(() => {
    setDrafts((current) => seedDeliveryPickerDrafts(current, selectedDelivery, calculation));
  }, [calculation, selectedDelivery]);

  useEffect(
    () => () => {
      confirmationRequestRef.current += 1;
      invalidateDeliveryConfirmation();
    },
    [invalidateDeliveryConfirmation],
  );

  const invalidatePendingConfirmation = () => {
    confirmationRequestRef.current += 1;
    invalidateDeliveryConfirmation();
    setIsConfirming(false);
  };

  const changePickerOpen = (isOpen: boolean) => {
    setIsPickerOpen(isOpen);

    if (!isOpen) {
      invalidatePendingConfirmation();
      setConfirmationError(undefined);
    }
  };

  const chooseCompany = (company: DeliveryCompanyCode) => {
    if (company === "ozon" && !isOzonDeliveryAvailable) return;
    invalidatePendingConfirmation();
    setPickerCompany(company);
    setConfirmationError(undefined);
    analytics.deliverySelected(company);
    if (!isPickerOpen) analytics.pickupPickerOpened();
    setIsPickerOpen(true);
  };

  const confirmCandidate = async () => {
    if (!candidate) return;

    analytics.pickupConfirmRequested();
    const requestId = ++confirmationRequestRef.current;
    setConfirmationError(undefined);
    setIsConfirming(true);
    const result = await confirmDelivery(candidate);

    if (requestId !== confirmationRequestRef.current) return;

    setIsConfirming(false);

    if (result.status === "confirmed") {
      analytics.pickupConfirmed(candidate.provider);
      setDrafts((current) => seedDeliveryPickerDrafts(current, candidate, result.calculation));
      changePickerOpen(false);
    } else if (result.status === "error") {
      analytics.pickupConfirmFailed();
      setConfirmationError(result.message);
    }
  };

  return (
    <div className="space-y-3">
      <RadioGroup
        aria-labelledby="checkout-section-02-heading"
        value={selectedDelivery?.provider ?? ""}
        className="gap-2"
      >
        {deliveryCompanies.map((company) => {
          const isAvailable = company.code === "cdek" || isOzonDeliveryAvailable;
          const isSelected = selectedDelivery?.provider === company.code;

          return (
            <Label
              key={company.code}
              htmlFor={`checkout-delivery-${company.code}`}
              className={cn(
                "flex min-h-20 min-w-0 cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3 font-normal transition-colors hover:border-rose-200 hover:bg-rose-50/40 has-data-[state=checked]:border-rose-300 has-data-[state=checked]:bg-rose-50/60 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-rose-200/60 dark:hover:bg-rose-950/20 dark:has-data-[state=checked]:border-rose-700 dark:has-data-[state=checked]:bg-rose-950/20 dark:has-data-[state=checked]:ring-rose-800/60",
                !isAvailable && "cursor-not-allowed opacity-50",
              )}
            >
              <RadioGroupItem
                id={`checkout-delivery-${company.code}`}
                value={company.code}
                disabled={!isAvailable}
                onClick={() => chooseCompany(company.code)}
                className="mt-0.5 data-[state=checked]:border-rose-500 data-[state=checked]:text-rose-500"
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="font-medium">Пункт выдачи {company.label}</span>
                  <span className="shrink-0 font-semibold">
                    {!isAvailable
                      ? "Недоступно"
                      : isSelected && calculation
                        ? formatMoney(calculation.deliveryPrice)
                        : company.code === "cdek"
                          ? "Доставка от 150 ₽"
                          : `Доставка от ${formatMoney(minimumDeliveryPrices.ozon)}`}
                  </span>
                </span>
                {!(isSelected && calculation) ? (
                  <span className="block text-sm text-muted-foreground">
                    {isAvailable
                      ? isSelected && checkoutCalculation.status === "pending"
                        ? "Считаем точную стоимость и срок"
                        : "Точная стоимость и срок после выбора ПВЗ"
                      : "Недоступно для этой корзины"}
                  </span>
                ) : null}
                {isSelected && selectedAddress ? (
                  <span className="flex items-start gap-2 pt-1 text-sm text-muted-foreground">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {selectedAddress}
                      {estimatedDeliveryDate ? (
                        <span className="mt-1 block text-xs">{estimatedDeliveryDate}</span>
                      ) : null}
                    </span>
                  </span>
                ) : null}
              </span>
            </Label>
          );
        })}
      </RadioGroup>

      <DeliveryPicker
        canConfirm={Boolean(candidate)}
        confirmationError={confirmationError}
        drafts={drafts}
        isConfirming={isConfirming}
        isOzonDeliveryAvailable={isOzonDeliveryAvailable}
        isOpen={isPickerOpen}
        selectedCompany={pickerCompany}
        onCompanyChange={(company) => {
          invalidatePendingConfirmation();
          setConfirmationError(undefined);
          setPickerCompany(company);
        }}
        onConfirm={() => void confirmCandidate()}
        onDraftChange={(updateDrafts) => {
          const nextDrafts = updateDrafts(drafts);
          const nextCandidate = getDeliveryDraftCandidate(nextDrafts, pickerCompany);

          if (!isSameDeliverySelection(candidate, nextCandidate)) {
            invalidatePendingConfirmation();
          }
          setConfirmationError(undefined);
          setDrafts(updateDrafts);
        }}
        onOpenChange={(open) => {
          if (!open) analytics.pickupPickerDismissed();
          changePickerOpen(open);
        }}
      />
    </div>
  );
}
