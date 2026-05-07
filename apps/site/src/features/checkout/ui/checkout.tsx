"use client";

import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { useCartData } from "@/entities/cart";
import { useUser } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

import { useCreateOrderMutation } from "../model";
import {
  type CheckoutCreateOrderInput,
  type CheckoutCustomerDefaults,
} from "../lib";

import { CheckoutForm } from "./form";
import { OrderSummary } from "./order-summary";

export function Checkout() {
  const router = useRouter();
  const user = useUser();
  const cart = useCartData();
  const { createOrder, isPending, error } = useCreateOrderMutation();
  const customerDefaults = useMemo<CheckoutCustomerDefaults>(
    () => ({
      ...(user?.email ? { email: user.email } : {}),
      ...(user?.name ? { name: user.name } : {}),
    }),
    [user?.email, user?.name],
  );

  const handleSubmit = async (input: CheckoutCreateOrderInput) => {
    try {
      const order = await createOrder(input);

      if (order?.id) {
        router.push(`${routes.checkoutSuccess}?orderId=${encodeURIComponent(order.id)}`);
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
          description="Проверяем товары в корзине перед отправкой заказа."
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
          <PageTitle className="text-foreground">Оформление заказа</PageTitle>
          <p className="max-w-2xl text-muted-foreground">
            Проверьте товары, оставьте контакты и отправьте заказ. Мы свяжемся для подтверждения
            деталей.
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
            customerDefaults={customerDefaults}
            isSubmitting={isPending}
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

        <OrderSummary cart={cart.data} />
      </div>
    </section>
  );
}

function getMutationErrorMessage(error: Error) {
  return error.message || "Проверьте данные и попробуйте еще раз.";
}
