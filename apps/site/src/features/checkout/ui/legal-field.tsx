"use client";

import { useId } from "react";
import { useFormContext } from "react-hook-form";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { PersonalDataConsentCheckbox } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { type CheckoutFormValues } from "../lib";

import { FieldError } from "./field-error";

export function LegalField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const offerId = useId();
  const personalDataConsentId = useId();

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div
          className={cn(
            "flex items-start gap-1 rounded-lg border bg-muted/30 p-1 text-sm",
            errors.acceptedLegal && "border-destructive/50 bg-destructive/5",
          )}
        >
          <label
            htmlFor={offerId}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center"
          >
            <input
              id={offerId}
              type="checkbox"
              className="size-4 shrink-0 rounded border-border accent-rose-500"
              aria-invalid={Boolean(errors.acceptedLegal)}
              aria-describedby={errors.acceptedLegal ? "checkout-legal-error" : undefined}
              {...register("acceptedLegal")}
            />
          </label>
          <span className="min-h-11 py-3 pr-2 text-muted-foreground">
            <label htmlFor={offerId} className="cursor-pointer">
              Я принимаю условия{" "}
            </label>
            <Link
              href={routes.legal.publicOffer}
              target="_blank"
              rel="noreferrer"
              aria-label="Публичная оферта (откроется в новой вкладке)"
              className="text-foreground underline"
            >
              публичной оферты
            </Link>
            <label htmlFor={offerId} className="cursor-pointer">
              .
            </label>
          </span>
        </div>
        <FieldError id="checkout-legal-error" message={errors.acceptedLegal?.message} />
      </div>
      <div className="space-y-1">
        <PersonalDataConsentCheckbox
          id={personalDataConsentId}
          hasError={Boolean(errors.acceptedPersonalDataConsent)}
          aria-describedby={
            errors.acceptedPersonalDataConsent ? "checkout-personal-data-consent-error" : undefined
          }
          {...register("acceptedPersonalDataConsent")}
        />
        <FieldError
          id="checkout-personal-data-consent-error"
          message={errors.acceptedPersonalDataConsent?.message}
        />
      </div>
    </div>
  );
}
