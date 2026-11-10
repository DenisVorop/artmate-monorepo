"use client";

import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import type { Cart, CartResult } from "@/entities/cart";
import { useCartData } from "@/entities/cart";
import { useUser } from "@/entities/session";
import { withAuth } from "@/features/auth";
import { usePromocode, withPromocode } from "@/features/promocode";
import { routes } from "@/shared/constants";
import { Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

import { useCreateOrderMutation } from "../model";
import type {
  CheckoutCreateOrderResponse,
  CheckoutCustomerDefaults,
  CheckoutProviderSubmitVariables,
} from "../lib";
import { useTrackCheckoutStart } from "../lib/use-track-checkout-start";
import { useAnalytics } from "../lib/analytics";
import { useCheckoutAuth } from "../lib/use-checkout-auth";

import { CheckoutFlow } from "./checkout-flow";

export function Checkout() {
  const analytics = useAnalytics();
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
          description="Обновите страницу или попробуйте немного позже."
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
            <Link href={routes.catalog} onClick={analytics.emptyCatalogOpened}>
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

function BaseLoadedCheckout({ cart }: { cart: Cart }) {
  useTrackCheckoutStart(cart);
  const { onLoginRequested } = useCheckoutAuth();
  return <PromocodeCheckout cart={cart} onPromocodeLoginRequested={onLoginRequested} />;
}

const LoadedCheckout = withAuth(BaseLoadedCheckout, { source: "checkout" });

function BasePromocodeCheckout({ cart }: { cart: Cart }) {
  return <CheckoutScenario cart={cart} />;
}

const PromocodeCheckout = withPromocode(BasePromocodeCheckout);

function CheckoutScenario({ cart }: { cart: Cart }) {
  const analytics = useAnalytics();
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
      analytics.paymentRedirected();
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
          <PageTitle className="text-foreground">Оформление заказа</PageTitle>
          <p className="max-w-2xl text-muted-foreground">
            Укажите контакты и выберите пункт выдачи.
          </p>
        </div>

        <Button asChild variant="outline" className="min-h-11">
          <Link href={routes.cart} onClick={analytics.cartOpened}>
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
