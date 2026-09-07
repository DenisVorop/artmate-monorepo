"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, Label, RadioGroup, RadioGroupItem } from "@/shared/ui";

import {
  createDeliveryPickerDrafts,
  formatMoney,
  getDeliveryDraftCandidate,
  isSameDeliverySelection,
  seedDeliveryPickerDrafts,
  useCheckout,
} from "../lib";

import { DeliveryPicker } from "./delivery-picker";
import { deliveryCompanies, type DeliveryCompanyCode } from "./delivery-selector/delivery-options";

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
  const { checkoutCalculation, confirmDelivery, invalidateDeliveryConfirmation, selectedDelivery } =
    useCheckout();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerCompany, setPickerCompany] = useState<DeliveryCompanyCode>(
    selectedDelivery?.provider ?? "cdek",
  );
  const [drafts, setDrafts] = useState(() => createDeliveryPickerDrafts(selectedDelivery));
  const [confirmationError, setConfirmationError] = useState<string>();
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmationRequestRef = useRef(0);
  const calculation =
    checkoutCalculation.status === "ready" ? checkoutCalculation.calculation : undefined;
  const selectedAddress = calculation?.delivery.pickupPoint.address;
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
    setIsPickerOpen(true);
  };

  const confirmCandidate = async () => {
    if (!candidate) return;

    const requestId = ++confirmationRequestRef.current;
    setConfirmationError(undefined);
    setIsConfirming(true);
    const result = await confirmDelivery(candidate);

    if (requestId !== confirmationRequestRef.current) return;

    setIsConfirming(false);

    if (result.status === "confirmed") {
      setDrafts((current) => seedDeliveryPickerDrafts(current, candidate, result.calculation));
      changePickerOpen(false);
    } else if (result.status === "error") {
      setConfirmationError(result.message);
    }
  };

  return (
    <div className="space-y-3">
      <RadioGroup
        aria-labelledby="checkout-section-02-heading"
        value={selectedDelivery?.provider}
        onValueChange={(value) => chooseCompany(value as DeliveryCompanyCode)}
        className="gap-0 divide-y border-y"
      >
        {deliveryCompanies.map((company) => {
          const isAvailable = company.code === "cdek" || isOzonDeliveryAvailable;
          const isSelected = selectedDelivery?.provider === company.code;

          return (
            <Label
              key={company.code}
              htmlFor={`checkout-delivery-${company.code}`}
              className="flex min-h-20 cursor-pointer items-start gap-3 py-4 font-normal"
            >
              <RadioGroupItem
                id={`checkout-delivery-${company.code}`}
                value={company.code}
                disabled={!isAvailable}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-center justify-between gap-4">
                  <span className="font-medium">Пункт выдачи {company.label}</span>
                  <span className="shrink-0 font-semibold">
                    {!isAvailable
                      ? "Недоступно"
                      : isSelected && calculation
                        ? formatMoney(calculation.deliveryPrice)
                        : company.code === "cdek"
                          ? "Рассчитать"
                          : `Доставка от ${formatMoney(minimumDeliveryPrices.ozon)}`}
                  </span>
                </span>
                <span className="block text-sm text-muted-foreground">
                  {isAvailable
                    ? isSelected && checkoutCalculation.status === "pending"
                      ? "Считаем точную стоимость и срок"
                      : "Точная стоимость и срок после выбора ПВЗ"
                    : "Недоступно для этой корзины"}
                </span>
                {isSelected && selectedAddress ? (
                  <span className="flex items-start gap-2 pt-1 text-sm text-muted-foreground">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>{selectedAddress}</span>
                  </span>
                ) : null}
              </span>
            </Label>
          );
        })}
      </RadioGroup>

      <Button
        type="button"
        variant="link"
        className="min-h-11 h-auto px-0 text-rose-600"
        onClick={() => {
          setPickerCompany(selectedDelivery?.provider ?? pickerCompany);
          setIsPickerOpen(true);
        }}
      >
        {selectedDelivery ? "Изменить ПВЗ" : "Выбрать ПВЗ"}
      </Button>

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
        onOpenChange={changePickerOpen}
      />
    </div>
  );
}
