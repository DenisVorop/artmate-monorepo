"use client";

import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Cart } from "@/entities/cart";
import { useCartData } from "@/entities/cart";
import { getPreferredCustomerPhone, useOrdersData } from "@/entities/orders";
import { useUser } from "@/entities/session";
import { AuthForm } from "@/features/auth";
import { usePromocode, withPromocode } from "@/features/promocode";
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
  type CheckoutAuthConfirmationState,
  type CheckoutCustomerDefaults,
  type CheckoutOrder,
  transitionCheckoutAuthConfirmation,
} from "../lib";

import { CheckoutFlow } from "./checkout-flow";

type AuthDialogDefaults = Pick<CheckoutCustomerDefaults, "email" | "name">;

export function Checkout() {
  const cart = useCartData();

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

  return <LoadedCheckout cart={cart.data} />;
}

function LoadedCheckout({ cart }: { cart: Cart }) {
  const [authDialogDefaults, setAuthDialogDefaults] = useState<AuthDialogDefaults>();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authConfirmationState, setAuthConfirmationState] =
    useState<CheckoutAuthConfirmationState>("ready");

  const requestLogin = (defaults?: AuthDialogDefaults) => {
    setAuthDialogDefaults(defaults);
    setAuthConfirmationState((state) => transitionCheckoutAuthConfirmation(state, "request-auth"));
    setIsAuthDialogOpen(true);
  };

  return (
    <PromocodeCheckout
      authDialogDefaults={authDialogDefaults}
      authConfirmationState={authConfirmationState}
      cart={cart}
      isAuthDialogOpen={isAuthDialogOpen}
      onAuthDialogOpenChange={setIsAuthDialogOpen}
      onAuthRequired={requestLogin}
      onAuthenticated={() => {
        setAuthConfirmationState((state) =>
          transitionCheckoutAuthConfirmation(state, "auth-succeeded"),
        );
        setIsAuthDialogOpen(false);
      }}
      onManualConfirmation={() =>
        setAuthConfirmationState((state) =>
          transitionCheckoutAuthConfirmation(state, "manual-confirmation"),
        )
      }
      onPromocodeLoginRequested={() => requestLogin()}
    />
  );
}

type PromocodeCheckoutProps = {
  authDialogDefaults?: AuthDialogDefaults;
  authConfirmationState: CheckoutAuthConfirmationState;
  cart: Cart;
  isAuthDialogOpen: boolean;
  onAuthDialogOpenChange: (_isOpen: boolean) => void;
  onAuthRequired: (_defaults?: AuthDialogDefaults) => void;
  onAuthenticated: () => void;
  onManualConfirmation: () => void;
};

function BasePromocodeCheckout({
  authDialogDefaults,
  authConfirmationState,
  cart,
  isAuthDialogOpen,
  onAuthDialogOpenChange,
  onAuthRequired,
  onAuthenticated,
  onManualConfirmation,
}: PromocodeCheckoutProps) {
  return (
    <>
      {authConfirmationState === "manual-confirmation-required" ? (
        <p className="container mb-4 rounded-lg border bg-muted/30 p-3 text-sm" role="status">
          Вход выполнен. Дождитесь нового расчета суммы и подтвердите заказ вручную.
        </p>
      ) : null}
      <CheckoutScenario
        cart={cart}
        onAuthRequired={onAuthRequired}
        onManualConfirmation={onManualConfirmation}
      />

      <Dialog open={isAuthDialogOpen} onOpenChange={onAuthDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Вход для оформления заказа</DialogTitle>
            <DialogDescription>
              После входа мы заново проверим промокод и итоговую сумму. Для создания заказа нужно
              будет явно подтвердить оформление еще раз.
            </DialogDescription>
          </DialogHeader>
          <AuthForm
            embedded
            key={`${authDialogDefaults?.email ?? ""}:${authDialogDefaults?.name ?? ""}`}
            initialEmail={authDialogDefaults?.email}
            initialName={authDialogDefaults?.name}
            isEmailLocked={Boolean(authDialogDefaults?.email)}
            showNameOptionalHint={false}
            onAuthenticated={onAuthenticated}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

const PromocodeCheckout = withPromocode(BasePromocodeCheckout);

function CheckoutScenario({
  cart,
  onAuthRequired,
  onManualConfirmation,
}: {
  cart: Cart;
  onAuthRequired: (_defaults?: AuthDialogDefaults) => void;
  onManualConfirmation: () => void;
}) {
  const router = useRouter();
  const user = useUser();
  const orders = useOrdersData({ enabled: Boolean(user) });
  const { clearCode } = usePromocode();
  const customerOrders = orders.isError ? [] : orders.data;
  const customerPhone = user?.phone ?? getPreferredCustomerPhone(customerOrders);
  const customerDefaults = useMemo<CheckoutCustomerDefaults>(
    () => ({
      ...(user?.email ? { email: user.email } : {}),
      ...(user?.name ? { name: user.name } : {}),
      ...(customerPhone ? { phone: customerPhone } : {}),
    }),
    [customerPhone, user?.email, user?.name],
  );
  const handleOrderCreated = (order: CheckoutOrder | undefined) => {
    clearCode();

    if (order?.payment.redirectUrl) {
      window.location.assign(order.payment.redirectUrl);
      return;
    }

    if (order?.id) {
      router.push(`${routes.checkoutSuccess}?orderId=${encodeURIComponent(order.id)}`);
    }
  };
  const { createOrder, isPending, error } = useCreateOrderMutation({
    onSuccess: handleOrderCreated,
  });

  const handleSubmit = async (input: CheckoutCreateOrderInput) => {
    if (!user) {
      onAuthRequired({ email: input.customer.email, name: input.customer.name });
      return;
    }

    onManualConfirmation();
    createOrder(input);
  };

  return (
    <section className="container py-8 md:py-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-rose-500 uppercase">Оформление</p>
          <PageTitle className="text-foreground">Оформление заказа</PageTitle>
          <p className="max-w-2xl text-muted-foreground">
            Проверьте товары, оставьте контакты и войдите в аккаунт, если еще не авторизованы. После
            этого мы отправим вас на страницу оплаты.
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
        cart={cart}
        createOrderError={error}
        customerDefaults={customerDefaults}
        isEmailLocked={Boolean(user?.email)}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        requiresAuth={!user}
      />
    </section>
  );
}
