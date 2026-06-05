"use client";

import { ArrowLeft, LoaderCircle, Send } from "lucide-react";
import { useFormContext } from "react-hook-form";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CtaGradientButton,
  Separator,
} from "@/shared/ui";

import {
  checkoutOrderFormId,
  formatEstimatedDeliveryDateRange,
  type CheckoutFormValues,
  useCheckout,
} from "../lib";

import { FieldError } from "./field-error";
import { LegalField } from "./legal-field";
import { PaymentMethodField } from "./payment-method-field";
import { ReviewBlock } from "./review-block";

export function CheckoutConfirmationStep() {
  const {
    checkoutCalculation,
    goBack,
    isSubmitting,
    requiresAuth,
    selectedDelivery,
    submitLabel,
    submitOrder,
  } = useCheckout();
  const {
    watch,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const [name, phone, email, comment] = watch(["name", "phone", "email", "comment"]);
  const pickupPoint = checkoutCalculation.calculation?.delivery.pickupPoint;
  const estimatedDeliveryDate = formatEstimatedDeliveryDateRange(
    checkoutCalculation.calculation?.estimatedDeliveryDateRange,
  );
  const isSubmitDisabled = isSubmitting || checkoutCalculation.isPending || !selectedDelivery;

  return (
    <form id={checkoutOrderFormId} onSubmit={submitOrder}>
      <Card>
        <CardHeader>
          <CardTitle>Подтверждение</CardTitle>
          <CardDescription>Проверьте контакты и условия перед переходом к оплате.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ReviewBlock label="Имя" value={name} />
            <ReviewBlock label="Телефон" value={phone} />
            <ReviewBlock label="Email" value={email} className="sm:col-span-2" />
            {comment.trim() ? (
              <ReviewBlock label="Комментарий" value={comment} className="sm:col-span-2" />
            ) : null}
          </div>

          <Separator />

          <PaymentMethodField />
          <FieldError message={errors.paymentMethod?.message} />

          <Separator />

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
            <p className="font-medium">
              {selectedDelivery?.provider === "cdek" ? "СДЭК" : "Ozon"}, пункт выдачи
            </p>
            {pickupPoint ? (
              <div className="mt-1 space-y-0.5 text-muted-foreground">
                <p>{pickupPoint.address}</p>
                <p className="text-xs">{pickupPoint.workHours}</p>
                {estimatedDeliveryDate ? (
                  <p className="text-xs">Доставка ориентировочно {estimatedDeliveryDate}.</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-muted-foreground">Доставка выбрана, стоимость обновляется.</p>
            )}
          </div>

          <LegalField />
          <FieldError message={errors.acceptedLegal?.message} />
          <FieldError message={errors.acceptedPersonalDataConsent?.message} />

          {requiresAuth ? (
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              После нажатия откроется вход по email, затем мы отправим вас на оплату.
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <Button type="button" variant="outline" onClick={goBack}>
            <ArrowLeft data-icon="inline-start" />
            Назад
          </Button>
          <CtaGradientButton
            type="submit"
            size="lg"
            disabled={isSubmitDisabled}
            className="min-w-44"
          >
            {isSubmitting ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            {submitLabel}
          </CtaGradientButton>
        </CardFooter>
      </Card>
    </form>
  );
}
