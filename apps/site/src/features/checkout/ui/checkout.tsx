"use client";

import { ArrowLeft, ArrowRight, ShoppingBag } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { type Cart, useCartData } from "@/entities/cart";
import { getPreferredCustomerPhone, useOrdersData } from "@/entities/orders";
import { useUser } from "@/entities/session";
import { AuthForm } from "@/features/auth";
import { routes } from "@/shared/constants";
import {
  Button,
  DataState,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

import { useCreateOrderMutation } from "../model";
import {
  type CheckoutCreateOrderInput,
  type CheckoutCustomerDefaults,
  type CheckoutOrder,
  useCheckout,
  withCheckout,
} from "../lib";

import { DeliverySelector } from "./delivery-selector";
import { CheckoutConfirmationStep, CheckoutContactsStep } from "./form";
import { OrderSummary } from "./order-summary";
import { CheckoutStepProgress } from "./step-progress";

export function Checkout() {
  const router = useRouter();
  const user = useUser();
  const cart = useCartData();
  const orders = useOrdersData({ enabled: Boolean(user) });
  const [pendingOrderInput, setPendingOrderInput] = useState<CheckoutCreateOrderInput>();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const handleOrderCreated = useCallback(
    (order: CheckoutOrder | undefined) => {
      setPendingOrderInput(undefined);
      setIsAuthDialogOpen(false);

      if (order?.id) {
        router.push(`${routes.checkoutSuccess}?orderId=${encodeURIComponent(order.id)}`);
      }
    },
    [router],
  );
  const { createOrder, isPending, error } = useCreateOrderMutation({
    onSuccess: handleOrderCreated,
  });
  const pendingCustomerEmail = pendingOrderInput?.customer.email;
  const pendingCustomerName = pendingOrderInput?.customer.name;
  const customerOrders = orders.isError ? [] : orders.data;
  const customerPhone = user?.phone ?? getPreferredCustomerPhone(customerOrders);
  const requiresAuth = !user;
  const customerDefaults = useMemo<CheckoutCustomerDefaults>(
    () => ({
      ...(user?.email ? { email: user.email } : {}),
      ...(user?.name ? { name: user.name } : {}),
      ...(customerPhone ? { phone: customerPhone } : {}),
    }),
    [customerPhone, user?.email, user?.name],
  );

  const handleSubmit = async (input: CheckoutCreateOrderInput) => {
    if (!user) {
      setPendingOrderInput(input);
      setIsAuthDialogOpen(true);
      return;
    }

    createOrder(input);
  };

  const handleCheckoutAuthenticated = () => {
    if (!pendingOrderInput) {
      setIsAuthDialogOpen(false);
      return;
    }

    setIsAuthDialogOpen(false);
    createOrder(pendingOrderInput);
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
            Проверьте товары, оставьте контакты и войдите в аккаунт, если еще не авторизованы. После
            этого мы автоматически отправим заказ.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href={routes.cart}>
            <ArrowLeft data-icon="inline-start" />
            Вернуться в корзину
          </Link>
        </Button>
      </div>

      <CheckoutFlow
        cart={cart.data}
        createOrderError={error}
        customerDefaults={customerDefaults}
        isEmailLocked={Boolean(user?.email)}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        requiresAuth={requiresAuth}
      />

      <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Вход для оформления заказа</DialogTitle>
            <DialogDescription>
              Код подтверждения придет на почту, указанную в форме заказа. После успешного входа
              заказ отправится автоматически.
            </DialogDescription>
          </DialogHeader>
          <AuthForm
            embedded
            key={`${pendingCustomerEmail ?? ""}:${pendingCustomerName ?? ""}`}
            initialEmail={pendingCustomerEmail}
            initialName={pendingCustomerName}
            isEmailLocked={Boolean(pendingCustomerEmail)}
            showNameOptionalHint={false}
            onAuthenticated={handleCheckoutAuthenticated}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

type CheckoutFlowProps = {
  cart: Cart;
  createOrderError: Error | null;
};

function BaseCheckoutFlow({ cart, createOrderError }: CheckoutFlowProps) {
  const { step } = useCheckout();

  return (
    <>
      <CheckoutStepProgress />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-4">
          <div hidden={step !== "delivery"}>
            <CheckoutDeliveryStep />
          </div>
          <div hidden={step !== "contacts"}>
            <CheckoutContactsStep />
          </div>
          <div hidden={step !== "confirmation"}>
            <CheckoutConfirmationStep />
          </div>

          {createOrderError ? (
            <DataState
              variant="error"
              title="Не удалось создать заказ"
              description={getMutationErrorMessage(createOrderError)}
              className="max-w-none"
            />
          ) : null}
        </div>

        <OrderSummary cart={cart} compact={step !== "confirmation"} />
      </div>
    </>
  );
}

const CheckoutFlow = withCheckout(BaseCheckoutFlow);

function CheckoutDeliveryStep() {
  const {
    canContinueDelivery,
    checkoutCalculation,
    continueFromDelivery,
    selectedDelivery,
    setSelectedDelivery,
  } = useCheckout();

  return (
    <div className="space-y-4">
      <DeliverySelector selectedDelivery={selectedDelivery} onChange={setSelectedDelivery} />

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
          <p className="text-sm text-muted-foreground">Выберите город и пункт выдачи.</p>
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

function getMutationErrorMessage(error: Error) {
  return error.message || "Проверьте данные и попробуйте еще раз.";
}
