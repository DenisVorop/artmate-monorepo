"use client";

import { Plus } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Input, Label, Textarea } from "@/shared/ui";

import {
  checkoutPhonePlaceholder,
  formatCheckoutPhone,
  type CheckoutFormValues,
  useCheckout,
} from "../lib";

import { FieldError } from "./field-error";
import styles from "./contact-fields.module.css";

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
  const phoneDescriptionIds = [phoneErrorId, "checkout-phone-helper"].filter(Boolean).join(" ");
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
        </p>
        <FieldError id="checkout-email-error" message={errors.email?.message} />
      </div>

      <div className="space-y-2 sm:col-span-2">
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
          aria-describedby={phoneDescriptionIds}
          className="min-h-11"
          {...phoneField}
          onChange={(event) => {
            event.target.value = formatCheckoutPhone(event.target.value);
            void phoneField.onChange(event);
          }}
        />
        <FieldError id="checkout-phone-error" message={errors.phone?.message} />
        <div
          id="checkout-phone-helper"
          className={`${styles.phoneHint} space-y-0.5 rounded-2xl bg-orange-100/50 px-3.5 py-2.5 text-xs leading-snug text-foreground supports-backdrop-filter:backdrop-blur-sm`}
        >
          <p className="font-semibold">Сверьте номер с профилем Ozon</p>
          <p>Если номера не совпадут, мы не сможем отправить заказ.</p>
        </div>
      </div>

      <details
        className="group sm:col-span-2"
        ref={(details) => {
          if (details && errors.comment) details.open = true;
        }}
      >
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-sm font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Plus aria-hidden="true" className="size-4 shrink-0 group-open:rotate-45" />
          Комментарий к заказу
          <span className="font-normal text-muted-foreground">(необязательно)</span>
        </summary>
        <Label htmlFor="checkout-comment" className="sr-only">
          Комментарий к заказу
        </Label>
        <Textarea
          id="checkout-comment"
          rows={2}
          maxLength={1000}
          placeholder="Например, пожелания по упаковке"
          aria-invalid={Boolean(errors.comment)}
          aria-describedby={commentErrorId}
          className="mt-1 resize-none"
          {...register("comment")}
        />
        <FieldError id="checkout-comment-error" message={errors.comment?.message} />
      </details>
    </div>
  );
}
