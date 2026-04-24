"use client";

import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { useCartData } from "@/entities/cart";
import type { CreateOrderInputDTO, OzonPickupPointDTO } from "@/shared/actions/orders";
import { routes } from "@/shared/constants";
import { Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { useCreateOrderMutation } from "../model";
import { getSelectedPickupPoint } from "../lib";

import { CheckoutForm } from "./form";
import { OrderSummary } from "./order-summary";

type CheckoutProps = {
  pickupPoints: OzonPickupPointDTO[];
  isPickupPointsError?: boolean;
};

export function Checkout({ pickupPoints, isPickupPointsError = false }: CheckoutProps) {
  const router = useRouter();
  const cart = useCartData();
  const defaultPickupPointId = pickupPoints[0]?.id ?? "";
  const [selectedPickupPointId, setSelectedPickupPointId] = useState(defaultPickupPointId);
  const { createOrder, isPending, error } = useCreateOrderMutation();
  const selectedPickupPoint = getSelectedPickupPoint(pickupPoints, selectedPickupPointId);

  const handleSubmit = async (input: CreateOrderInputDTO) => {
    try {
      const order = await createOrder(input);

      if (order?.payment.redirectUrl) {
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

  if (isPickupPointsError || pickupPoints.length === 0) {
    return (
      <section className="container py-10">
        <DataState
          variant="error"
          title="Не удалось загрузить ПВЗ"
          description="Попробуйте обновить страницу или вернитесь к оформлению позже."
        />
      </section>
    );
  }

  return (
    <section className="container py-8 md:py-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-rose-500 uppercase">Оформление</p>
          <h1 className="font-display text-3xl font-bold tracking-normal text-foreground md:text-4xl">
            Доставка и оплата
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Выберите ПВЗ Ozon, проверьте контакты и перейдите к моковой оплате заказа.
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
          <CheckoutForm
            pickupPoints={pickupPoints}
            selectedPickupPointId={selectedPickupPointId}
            isSubmitting={isPending}
            onPickupPointChange={setSelectedPickupPointId}
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

        <OrderSummary cart={cart.data} pickupPoint={selectedPickupPoint} />
      </div>
    </section>
  );
}

function getMutationErrorMessage(error: Error) {
  return error.message || "Проверьте данные и попробуйте еще раз.";
}
