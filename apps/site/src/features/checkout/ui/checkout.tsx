"use client";

import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useCartData } from "@/entities/cart";
import { useUser } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

import { useCheckoutCalculation, useCreateOrderMutation, useOzonPickupPoints } from "../model";
import {
  getSelectedDeliveryPoint,
  markPendingOrderPayment,
  type CheckoutCreateOrderInput,
  type CheckoutCustomerDefaults,
  type CheckoutDeliveryCityId,
} from "../lib";

import { CheckoutForm } from "./form";
import { OrderSummary } from "./order-summary";
import { PickupPointSelector } from "./pickup-point-selector";

export function Checkout() {
  const router = useRouter();
  const user = useUser();
  const cart = useCartData();
  const [cityId, setCityId] = useState<CheckoutDeliveryCityId>("moscow");
  const [selectedPickupPointId, setSelectedPickupPointId] = useState("");
  const pickupPoints = useOzonPickupPoints(cityId);
  const pointInfo = useMemo(() => pickupPoints.data?.points ?? [], [pickupPoints.data?.points]);
  const selectedPoint = getSelectedDeliveryPoint(pointInfo, selectedPickupPointId);
  const selectedPickupPointAddress = selectedPoint?.available ? selectedPoint.address : undefined;
  const calculation = useCheckoutCalculation(selectedPickupPointAddress);
  const { createOrder, isPending, error } = useCreateOrderMutation();
  const customerDefaults = useMemo<CheckoutCustomerDefaults>(
    () => ({
      ...(user?.email ? { email: user.email } : {}),
      ...(user?.name ? { name: user.name } : {}),
    }),
    [user?.email, user?.name],
  );
  const canSubmitOrder = Boolean(
    selectedPoint?.available &&
    calculation.data &&
    !calculation.isError &&
    !calculation.isPending &&
    !calculation.isFetching,
  );

  useEffect(() => {
    if (pointInfo.length === 0) {
      setSelectedPickupPointId("");

      return;
    }

    const currentPoint = getSelectedDeliveryPoint(pointInfo, selectedPickupPointId);

    if (currentPoint?.available) {
      return;
    }

    const firstAvailablePoint = pointInfo.find((point) => point.available);

    setSelectedPickupPointId(firstAvailablePoint ? String(firstAvailablePoint.map_point_id) : "");
  }, [pointInfo, selectedPickupPointId]);

  const handleSubmit = async (input: CheckoutCreateOrderInput) => {
    if (!canSubmitOrder) {
      return;
    }

    try {
      const order = await createOrder(input);

      if (order?.payment.redirectUrl) {
        markPendingOrderPayment(order.id);
        router.push(order.payment.redirectUrl);
      }
    } catch {
      // Ошибка уже сохранена в mutation state и показана под формой.
    }
  };

  if (cart.isPending) {
    return (
      <section className="container py-10">
        <DataState
          title="Готовим оформление"
          description="Проверяем товары в корзине и доступные способы доставки."
        />
      </section>
    );
  }

  if (cart.isError) {
    return (
      <section className="container py-10">
        <DataState
          variant="error"
          title="Не удалось загрузить корзину"
          description="Проверьте, что API запущен, и попробуйте обновить страницу."
        />
      </section>
    );
  }

  if (!cart.data || cart.data.items.length === 0) {
    return (
      <section className="container py-10">
        <DataState
          title="Корзина пуста"
          description="Добавьте товары в корзину, чтобы перейти к оформлению заказа."
        />
        <div className="mt-5 flex justify-center">
          <Button asChild size="lg">
            <Link href={routes.catalog}>
              <ShoppingBag data-icon="inline-start" />
              Перейти в каталог
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="container py-8 md:py-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-rose-500 uppercase">Оформление</p>
          <PageTitle className="text-foreground">Доставка и оплата</PageTitle>
          <p className="max-w-2xl text-muted-foreground">
            Выберите ПВЗ Ozon, проверьте контакты и перейдите к защищенной оплате заказа.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href={routes.cart}>
            <ArrowLeft data-icon="inline-start" />
            Вернуться в корзину
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-4">
          <PickupPointSelector
            cityId={cityId}
            map={pickupPoints.data?.map}
            points={pointInfo}
            selectedPickupPointId={selectedPickupPointId}
            isPending={pickupPoints.isPending}
            isFetching={pickupPoints.isFetching}
            isError={pickupPoints.isError}
            error={pickupPoints.error}
            onCityChange={(nextCityId) => {
              setCityId(nextCityId);
              setSelectedPickupPointId("");
            }}
            onPickupPointChange={setSelectedPickupPointId}
            onRetry={() => {
              void pickupPoints.refetch();
            }}
          />

          {calculation.isError && selectedPickupPointAddress && (
            <DataState
              variant="error"
              title="Не удалось рассчитать доставку"
              description={getQueryErrorMessage(calculation.error)}
              className="max-w-none"
            />
          )}

          <CheckoutForm
            selectedPickupPointAddress={selectedPickupPointAddress ?? ""}
            customerDefaults={customerDefaults}
            isSubmitting={isPending}
            isSubmitDisabled={!canSubmitOrder}
            onSubmit={handleSubmit}
          />

          {error && (
            <DataState
              variant="error"
              title="Не удалось создать заказ"
              description={getMutationErrorMessage(error)}
              className="max-w-none"
            />
          )}
        </div>

        <OrderSummary
          cart={cart.data}
          calculation={calculation.data}
          selectedPoint={selectedPoint}
          isCalculationPending={calculation.isPending || calculation.isFetching}
          isCalculationError={calculation.isError}
        />
      </div>
    </section>
  );
}

function getQueryErrorMessage(error: Error | null) {
  return error?.message || "Выберите другой ПВЗ или попробуйте обновить расчет.";
}

function getMutationErrorMessage(error: Error) {
  return error.message || "Проверьте данные и попробуйте еще раз.";
}
