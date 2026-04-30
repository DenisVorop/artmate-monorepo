"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, LoaderCircle } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { routes } from "@/shared/constants";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import {
  checkoutFormValidationSchema,
  checkoutPhonePlaceholder,
  type CheckoutCustomerDefaults,
  formatCheckoutPhone,
  getDefaultCheckoutFormValues,
  toCreateOrderInput,
  type CheckoutFormValues,
} from "../lib";

type CheckoutFormProps = {
  selectedPickupPointAddress: string;
  customerDefaults?: CheckoutCustomerDefaults;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  onSubmit: (_input: ReturnType<typeof toCreateOrderInput>) => Promise<void>;
};

export function CheckoutForm({
  selectedPickupPointAddress,
  customerDefaults,
  isSubmitting,
  isSubmitDisabled,
  onSubmit,
}: CheckoutFormProps) {
  const defaultValues = useMemo(
    () => ({
      ...getDefaultCheckoutFormValues(customerDefaults),
      pickupPointAddress: selectedPickupPointAddress,
    }),
    [customerDefaults, selectedPickupPointAddress],
  );
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<CheckoutFormValues>({
    defaultValues,
    mode: "onSubmit",
    resolver: zodResolver(checkoutFormValidationSchema),
  });
  const phoneField = register("phone");

  useEffect(() => {
    if (!isDirty) {
      reset(defaultValues);
    }
  }, [defaultValues, isDirty, reset]);

  useEffect(() => {
    setValue("pickupPointAddress", selectedPickupPointAddress, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [selectedPickupPointAddress, setValue]);

  const submitForm = handleSubmit(async (values) => {
    await onSubmit(toCreateOrderInput(values));
  });

  return (
    <form onSubmit={submitForm} className="space-y-4">
      <input type="hidden" {...register("pickupPointAddress")} />

      <Card>
        <CardHeader>
          <CardTitle>Контакты</CardTitle>
          <CardDescription>Используем эти данные для заказа и уведомлений.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="checkout-name">Имя</Label>
            <Input
              id="checkout-name"
              type="text"
              autoComplete="name"
              placeholder="Анна Иванова"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkout-phone">Телефон</Label>
            <Input
              id="checkout-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={checkoutPhonePlaceholder}
              maxLength={checkoutPhonePlaceholder.length}
              aria-invalid={Boolean(errors.phone)}
              {...phoneField}
              onChange={(event) => {
                event.target.value = formatCheckoutPhone(event.target.value);
                void phoneField.onChange(event);
              }}
            />
            <FieldError message={errors.phone?.message} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="checkout-email">Email</Label>
            <Input
              id="checkout-email"
              type="email"
              autoComplete="email"
              placeholder="anna@example.com"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Оплата</CardTitle>
          <CardDescription>
            Оплата проходит на защищенной платежной странице Ozon Pay.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
              <CreditCard className="size-4" />
            </span>
            <div>
              <p className="font-medium">Онлайн-оплата картой</p>
              <p className="text-sm text-muted-foreground">
                После подтверждения заказа откроется платежная страница. Artmate не хранит реквизиты
                банковских карт.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkout-comment">
              Комментарий <span className="text-muted-foreground">(необязательно)</span>
            </Label>
            <Textarea
              id="checkout-comment"
              rows={4}
              placeholder="Например, пожелания по упаковке"
              className="min-h-24 resize-none"
              {...register("comment")}
            />
            <FieldError message={errors.comment?.message} />
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-border accent-rose-500"
              aria-invalid={Boolean(errors.acceptedLegal)}
              {...register("acceptedLegal")}
            />
            <span className="text-muted-foreground">
              Я принимаю{" "}
              <Link href={routes.legal.publicOffer} className="text-foreground underline">
                оферту
              </Link>{" "}
              и{" "}
              <Link href={routes.legal.personalDataConsent} className="text-foreground underline">
                соглашаюсь на обработку персональных данных
              </Link>
              .
            </span>
          </label>
          <FieldError message={errors.acceptedLegal?.message} />
        </CardContent>
      </Card>

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting || isSubmitDisabled}
        className="h-11 w-full bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500"
      >
        {isSubmitting ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <CreditCard data-icon="inline-start" />
        )}
        Перейти к оплате
      </Button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}
