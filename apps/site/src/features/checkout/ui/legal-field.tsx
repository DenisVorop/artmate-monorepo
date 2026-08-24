"use client";

import { useId } from "react";
import { useFormContext } from "react-hook-form";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { PersonalDataConsentCheckbox } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { type CheckoutFormValues } from "../lib";

export function LegalField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const offerId = useId();
  const personalDataConsentId = useId();

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm",
          errors.acceptedLegal && "border-destructive/50 bg-destructive/5",
        )}
      >
        <input
          id={offerId}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-border accent-rose-500"
          aria-invalid={Boolean(errors.acceptedLegal)}
          {...register("acceptedLegal")}
        />
        <span className="text-muted-foreground">
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
      <PersonalDataConsentCheckbox
        id={personalDataConsentId}
        hasError={Boolean(errors.acceptedPersonalDataConsent)}
        {...register("acceptedPersonalDataConsent")}
      />
    </div>
  );
}
