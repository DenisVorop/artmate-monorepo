"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, LoaderCircle, MapPin } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

import type { OzonPickupPointDTO } from "@/shared/actions/orders";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
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
  formatMoney,
  formatCheckoutPhone,
  getDefaultCheckoutFormValues,
  toCreateOrderInput,
  type CheckoutFormValues,
} from "../lib";

type CheckoutFormProps = {
  pickupPoints: OzonPickupPointDTO[];
  selectedPickupPointId: string;
  customerDefaults?: CheckoutCustomerDefaults;
  isSubmitting: boolean;
  onPickupPointChange: (_pickupPointId: string) => void;
  onSubmit: (_input: ReturnType<typeof toCreateOrderInput>) => Promise<void>;
};

export function CheckoutForm({
  pickupPoints,
  selectedPickupPointId,
  customerDefaults,
  isSubmitting,
  onPickupPointChange,
  onSubmit,
}: CheckoutFormProps) {
  const defaultValues = useMemo(
    () => getDefaultCheckoutFormValues(pickupPoints, customerDefaults),
    [customerDefaults, pickupPoints],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    defaultValues,
    mode: "onSubmit",
    resolver: zodResolver(checkoutFormValidationSchema),
  });
  const phoneField = register("phone");

  const submitForm = handleSubmit(async (values) => {
    await onSubmit(toCreateOrderInput(values));
  });

  return (
    <form onSubmit={submitForm} className="space-y-4">
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
          <CardTitle>Пункт выдачи Ozon</CardTitle>
          <CardDescription>Выберите удобный ПВЗ для получения заказа.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pickupPoints.map((pickupPoint) => {
            const selected = pickupPoint.id === selectedPickupPointId;

            return (
              <label
                key={pickupPoint.id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border bg-background p-4 transition-colors",
                  selected
                    ? "border-rose-300 bg-rose-50/70 ring-2 ring-rose-200/70"
                    : "hover:border-rose-200 hover:bg-muted/40",
                )}
              >
                <input
                  type="radio"
                  value={pickupPoint.id}
                  className="mt-1 size-4 accent-rose-500"
                  {...register("pickupPointId", {
                    onChange: (event) => onPickupPointChange(event.target.value),
                  })}
                />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-center gap-2 font-medium">
                    <MapPin className="size-4 text-rose-500" />
                    {pickupPoint.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">{pickupPoint.address}</span>
                  <span className="block text-sm text-muted-foreground">
                    {pickupPoint.workHours}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">
                  {formatMoney(pickupPoint.deliveryPrice)}
                </span>
              </label>
            );
          })}
          <FieldError message={errors.pickupPointId?.message} />
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
                После подтверждения заказа откроется платежная страница. Artmate не хранит
                реквизиты банковских карт.
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
        disabled={isSubmitting}
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
