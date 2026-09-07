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
  const nameErrorId = errors.name ? "checkout-name-error" : undefined;
  const phoneErrorId = errors.phone ? "checkout-phone-error" : undefined;
  const emailErrorId = errors.email ? "checkout-email-error" : undefined;
  const commentErrorId = errors.comment ? "checkout-comment-error" : undefined;
  const emailDescriptionIds = ["checkout-email-helper", emailErrorId].filter(Boolean).join(" ");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="checkout-name">Имя</Label>
        <Input
          id="checkout-name"
          type="text"
          autoComplete="name"
          placeholder="Анна Иванова"
          aria-required={true}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={nameErrorId}
          className="min-h-11"
          {...register("name")}
        />
        <FieldError id="checkout-name-error" message={errors.name?.message} />
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
          aria-required={true}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={phoneErrorId}
          className="min-h-11"
          {...phoneField}
          onChange={(event) => {
            event.target.value = formatCheckoutPhone(event.target.value);
            void phoneField.onChange(event);
          }}
        />
        <FieldError id="checkout-phone-error" message={errors.phone?.message} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="checkout-email">Электронная почта</Label>
        <Input
          id="checkout-email"
          type="email"
          autoComplete="email"
          placeholder="anna@example.com"
          maxLength={254}
          readOnly={isEmailLocked}
          aria-readonly={isEmailLocked}
          aria-required={true}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={emailDescriptionIds}
          className={
            isEmailLocked ? "min-h-11 cursor-not-allowed bg-input/50 opacity-75" : "min-h-11"
          }
          {...register("email")}
        />
        <p id="checkout-email-helper" className="text-xs text-muted-foreground">
          Пришлём чек и информацию о заказе.
          {!isEmailLocked
            ? " Если аккаунта ещё нет, после оплаты пришлём отдельное письмо для завершения регистрации."
            : null}
        </p>
        <FieldError id="checkout-email-error" message={errors.email?.message} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="checkout-comment">
          Комментарий <span className="text-muted-foreground">(необязательно)</span>
        </Label>
        <Textarea
          id="checkout-comment"
          rows={4}
          maxLength={1000}
          placeholder="Например, пожелания по упаковке"
          aria-invalid={Boolean(errors.comment)}
          aria-describedby={commentErrorId}
          className="min-h-24 resize-none"
          {...register("comment")}
        />
        <FieldError id="checkout-comment-error" message={errors.comment?.message} />
      </div>
    </div>
  );
}
