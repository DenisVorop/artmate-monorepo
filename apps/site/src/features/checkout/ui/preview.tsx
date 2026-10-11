"use client";

import { Coins, Tag, Trash2, UserRound } from "lucide-react";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Button,
  Separator,
} from "@/shared/ui";
import { PageTitle } from "@/shared/ui/typography";

import { checkoutOrderFormId, formatEstimatedDeliveryDateRange, useCheckout } from "../lib";
import { useCheckoutPreview, withCheckoutPreview } from "../lib/checkout-preview-provider";
import { previewCart, previewLoyalty } from "../lib/preview-data";
import { ContactFields } from "./contact-fields";
import { PaymentMethodField } from "./payment-method-field";
import { BaseLoyaltyField } from "./loyalty-field";
import { BaseOrderSummary } from "./order-summary";

function BaseCheckoutPreview() {
  const checkout = useCheckout();
  const { hasPromo, setHasPromo, hasDelivery, setHasDelivery, notice } = useCheckoutPreview();
  const calculation =
    checkout.checkoutCalculation.status === "ready"
      ? checkout.checkoutCalculation.calculation
      : undefined;
  const estimatedDeliveryDate = formatEstimatedDeliveryDateRange(
    calculation?.estimatedDeliveryDateRange,
  );
  const promoPreview = hasPromo
    ? {
        code: "ART10",
        cartId: previewCart.id,
        subtotal: 1398,
        discount: 139.8,
        total: 1258.2,
        currency: "RUB" as const,
      }
    : undefined;
  return (
    <section className="container space-y-6 py-8 md:py-12">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
        <span className="font-medium">Предпросмотр · тестовые данные</span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <UserRound className="size-4" />
          Анна Иванова
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <Coins className="size-4" />1 250 баллов
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto min-h-11"
          onClick={() => setHasDelivery(!hasDelivery)}
        >
          {hasDelivery ? "Без выбранной доставки" : "Выбрать доставку Ozon"}
        </Button>
      </div>
      <div className="space-y-2">
        <PageTitle>Оформление заказа</PageTitle>
        <p className="text-muted-foreground">Укажите контакты и выберите пункт выдачи.</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <form
          id={checkoutOrderFormId}
          onSubmit={checkout.submitOrder}
          className="overflow-hidden rounded-xl border bg-background px-4 sm:px-6"
        >
          <section className="space-y-5 py-6 sm:py-8">
            <h2 className="text-xl font-semibold">
              <span className="mr-3 font-mono text-sm text-rose-500">01</span>Получатель
            </h2>
            <ContactFields />
          </section>
          <Separator />
          <section className="space-y-5 py-6 sm:py-8">
            <h2 className="text-xl font-semibold">
              <span className="mr-3 font-mono text-sm text-rose-500">02</span>Доставка
            </h2>
            <Button
              type="button"
              variant="outline"
              className="block h-auto w-full rounded-xl border-rose-200 bg-rose-50/40 p-4 text-left text-sm font-normal whitespace-normal"
              onClick={() => setHasDelivery(true)}
            >
              <div className="flex justify-between gap-3 font-medium">
                <span>Пункт выдачи Ozon</span>
                <span>{hasDelivery ? "100 ₽" : "Доставка от 100 ₽"}</span>
              </div>
              <p className="mt-2 text-muted-foreground">
                {hasDelivery
                  ? "Москва, ул. Большая Полянка, 28"
                  : "Точная стоимость и срок после выбора ПВЗ"}
              </p>
              {hasDelivery && estimatedDeliveryDate ? (
                <p className="mt-1 text-xs text-muted-foreground">{estimatedDeliveryDate}</p>
              ) : null}
            </Button>
          </section>
          <Separator />
          <section className="space-y-5 py-6 sm:py-8">
            <h2 className="text-xl font-semibold">
              <span className="mr-3 font-mono text-sm text-rose-500">03</span>Способ оплаты
            </h2>
            <PaymentMethodField />
          </section>
        </form>
        <BaseOrderSummary
          cart={previewCart}
          createOrderError={null}
          isSubmitDisabled={false}
          isSubmitting={false}
          submitLabel={checkout.submitLabel}
          checkoutCalculation={checkout.checkoutCalculation}
          hasDevelopmentBanner={true}
          promoPreview={promoPreview}
          isPromoReady={true}
          promoSlot={
            <Accordion type="single" collapsible defaultValue="promo">
              <AccordionItem value="promo" className="border-0">
                <AccordionTrigger className="min-h-12 items-center gap-2 hover:no-underline">
                  <Tag className="size-4 text-muted-foreground" />
                  <span className="flex-1">Промокод</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">ART10</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size={hasPromo ? "icon" : "default"}
                      className="min-h-11 min-w-11 text-muted-foreground"
                      aria-label={hasPromo ? "Убрать промокод" : undefined}
                      onClick={() => setHasPromo(!hasPromo)}
                    >
                      {hasPromo ? <Trash2 className="size-4" aria-hidden="true" /> : "Применить"}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          }
          loyaltySlot={
            <BaseLoyaltyField
              isSignedIn
              isSessionPending={false}
              overview={{ data: previewLoyalty, isError: false, isPending: false }}
              loyalty={checkout.loyalty}
              isSubmitting={false}
              hasDelivery={hasDelivery}
              checkoutCalculation={checkout.checkoutCalculation}
            />
          }
        />
      </div>
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
    </section>
  );
}

export const CheckoutPreview = withCheckoutPreview(BaseCheckoutPreview);
