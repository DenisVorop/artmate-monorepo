"use client";

import { ArrowRight } from "lucide-react";

import { Button, DataState } from "@/shared/ui";

import { useCheckout } from "../lib";

import { DeliverySelector } from "./delivery-selector";

type CheckoutDeliveryStepProps = {
  isOzonDeliveryAvailable: boolean;
};

export function CheckoutDeliveryStep({ isOzonDeliveryAvailable }: CheckoutDeliveryStepProps) {
  const {
    canContinueDelivery,
    checkoutCalculation,
    continueFromDelivery,
    selectedDelivery,
    setSelectedDelivery,
  } = useCheckout();

  return (
    <div className="space-y-4">
      <DeliverySelector
        isOzonDeliveryAvailable={isOzonDeliveryAvailable}
        selectedDelivery={selectedDelivery}
        onChange={setSelectedDelivery}
      />

      {checkoutCalculation.isError ? (
        <DataState
          variant="error"
          title="Не удалось рассчитать доставку"
          description="Попробуйте выбрать другой пункт выдачи или обновить страницу."
          className="max-w-none"
        />
      ) : null}

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {!selectedDelivery ? (
          <p className="text-sm text-muted-foreground">Выберите службу доставки и пункт выдачи.</p>
        ) : checkoutCalculation.isPending ? (
          <p className="text-sm text-muted-foreground">Дождитесь расчета стоимости доставки.</p>
        ) : null}
        <Button
          type="button"
          disabled={!canContinueDelivery}
          className="bg-rose-500 text-white hover:bg-rose-600"
          onClick={continueFromDelivery}
        >
          Продолжить
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
