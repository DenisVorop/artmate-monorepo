"use client";

import { useFormContext } from "react-hook-form";

import { Input, Label, Textarea } from "@/shared/ui";

import {
  checkoutPhonePlaceholder,
  formatCheckoutPhone,
  type CheckoutFormValues,
  useCheckout,
} from "../lib";

import { FieldError } from "./field-error";

export function ContactFields() {
  const { isEmailLocked } = useCheckout();
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const phoneField = register("phone");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
          readOnly={isEmailLocked}
          aria-readonly={isEmailLocked}
          aria-invalid={Boolean(errors.email)}
          className={isEmailLocked ? "cursor-not-allowed bg-input/50 opacity-75" : undefined}
          {...register("email")}
        />
        {isEmailLocked ? (
          <p className="text-xs text-muted-foreground">
            Email взяли из профиля, на него придет подтверждение входа и заказа.
          </p>
        ) : null}
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
    </div>
  );
}
