"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Send } from "lucide-react";
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
  customerDefaults?: CheckoutCustomerDefaults;
  isSubmitting: boolean;
  onSubmit: (_input: ReturnType<typeof toCreateOrderInput>) => Promise<void>;
};

export function CheckoutForm({
  customerDefaults,
  isSubmitting,
  onSubmit,
}: CheckoutFormProps) {
  const defaultValues = useMemo(
    () => getDefaultCheckoutFormValues(customerDefaults),
    [customerDefaults],
  );
  const {
    register,
    handleSubmit,
    reset,
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

  const submitForm = handleSubmit(async (values) => {
    await onSubmit(toCreateOrderInput(values));
  });

  return (
    <form onSubmit={submitForm} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Оформление заказа</CardTitle>
          <CardDescription>Оставьте контакты, и мы свяжемся для подтверждения.</CardDescription>
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

          <div className="space-y-2 sm:col-span-2">
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

          <label className="flex items-start gap-3 text-sm sm:col-span-2">
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
          <div className="sm:col-span-2">
            <FieldError message={errors.acceptedLegal?.message} />
          </div>
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
          <Send data-icon="inline-start" />
        )}
        Отправить заказ
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
