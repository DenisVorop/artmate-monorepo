"use client";

import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import type { Cart, CartResult } from "@/entities/cart";
import { useCartData } from "@/entities/cart";
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
import type {
  CheckoutCreateOrderResponse,
  CheckoutCustomerDefaults,
  CheckoutProviderSubmitVariables,
} from "../lib";
import { useTrackCheckoutStart } from "../lib/use-track-checkout-start";

import { CheckoutFlow } from "./checkout-flow";

export function Checkout() {
  const cart = useCartData({ refreshOnMount: true });
  const [verifiedCart, setVerifiedCart] = useState<CartResult | undefined>(undefined);

  useEffect(() => {
    if (cart.isFetchedAfterMount && cart.isSuccess) {
      setVerifiedCart(cart.data ?? null);
    }
  }, [cart.data, cart.isFetchedAfterMount, cart.isSuccess]);

  if (verifiedCart === undefined && cart.isFetchedAfterMount && cart.isError) {
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

  if (verifiedCart === undefined) {
    return (
      <section className="container py-10">
        <DataState
          title="Готовим оформление"
          description="Проверяем товары в корзине перед отправкой заказа."
        />
      </section>
    );
  }

  if (!verifiedCart || verifiedCart.items.length === 0) {
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

  return <LoadedCheckout cart={verifiedCart} />;
}

function LoadedCheckout({ cart }: { cart: Cart }) {
  useTrackCheckoutStart(cart);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

  return (
    <PromocodeCheckout
      cart={cart}
      isAuthDialogOpen={isAuthDialogOpen}
      onAuthDialogOpenChange={setIsAuthDialogOpen}
      onAuthenticated={() => setIsAuthDialogOpen(false)}
      onPromocodeLoginRequested={() => setIsAuthDialogOpen(true)}
    />
  );
}

type PromocodeCheckoutProps = {
  cart: Cart;
  isAuthDialogOpen: boolean;
  onAuthDialogOpenChange: (_isOpen: boolean) => void;
  onAuthenticated: () => void;
};

function BasePromocodeCheckout({
  cart,
  isAuthDialogOpen,
  onAuthDialogOpenChange,
  onAuthenticated,
}: PromocodeCheckoutProps) {
  return (
    <>
      <CheckoutScenario cart={cart} />

      <Dialog open={isAuthDialogOpen} onOpenChange={onAuthDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Вход в аккаунт</DialogTitle>
            <DialogDescription>
              После входа мы заново проверим промокод и итоговую сумму.
            </DialogDescription>
          </DialogHeader>
          <AuthForm embedded showNameOptionalHint={false} onAuthenticated={onAuthenticated} />
        </DialogContent>
      </Dialog>
    </>
  );
}

const PromocodeCheckout = withPromocode(BasePromocodeCheckout);

function CheckoutScenario({ cart }: { cart: Cart }) {
  const user = useUser();
  const { clearCode } = usePromocode();
  const customerDefaults: CheckoutCustomerDefaults = {
    ...(user?.email ? { email: user.email } : {}),
    ...(user?.name ? { name: user.name } : {}),
    ...(user?.phone ? { phone: user.phone } : {}),
  };
  const handleOrderCreated = (response: CheckoutCreateOrderResponse | undefined) => {
    clearCode();

    if (response?.redirectUrl) {
      window.location.assign(response.redirectUrl);
    }
  };
  const { createOrder, isPending, error } = useCreateOrderMutation({
    onSuccess: handleOrderCreated,
  });

  const handleSubmit = async (variables: CheckoutProviderSubmitVariables) => {
    await createOrder(variables);
  };

  return (
    <section className="container py-8 md:py-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-rose-500 uppercase">Оформление</p>
          <PageTitle className="text-foreground">Оформление заказа</PageTitle>
          <p className="max-w-2xl text-muted-foreground">
            Проверьте товары и оставьте контакты. После создания заказа мы отправим вас на страницу
            оплаты.
          </p>
        </div>

        <Button asChild variant="outline" className="min-h-11">
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
      />
    </section>
  );
}
