"use client";

import { useAnalytics } from "../lib/analytics";
import { useId } from "react";
import { useFormContext } from "react-hook-form";

import { routes } from "@/shared/constants";
import { PersonalDataConsentCheckbox } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { checkoutOrderFormId, type CheckoutFormValues } from "../lib";

import { FieldError } from "./field-error";

export function LegalField() {
  const analytics = useAnalytics();
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const offerId = useId();
  const personalDataConsentId = useId();

  return (
    <div className="space-y-2 [&_input[aria-invalid=true]]:outline [&_input[aria-invalid=true]]:outline-1 [&_input[aria-invalid=true]]:outline-offset-2 [&_input[aria-invalid=true]]:outline-destructive/50">
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-2 gap-y-1 text-xs leading-5">
        <label
          htmlFor={offerId}
          className="row-span-2 flex min-h-11 w-5 shrink-0 cursor-pointer items-start justify-center pt-0.5"
        >
          <input
            id={offerId}
            type="checkbox"
            form={checkoutOrderFormId}
            className="size-4 shrink-0 rounded border-border accent-rose-500"
            aria-invalid={Boolean(errors.acceptedLegal)}
            aria-describedby={errors.acceptedLegal ? "checkout-legal-error" : undefined}
            {...register("acceptedLegal", {
              onChange: (event) =>
                event.target.checked ? analytics.offerAccepted() : analytics.offerUnchecked(),
            })}
          />
        </label>
        <span className="text-muted-foreground">
          <label htmlFor={offerId} className="cursor-pointer">
            Я принимаю условия{" "}
          </label>
          <Link
            href={routes.legal.publicOffer}
            onClick={analytics.offerOpened}
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
        <FieldError
          id="checkout-legal-error"
          message={errors.acceptedLegal?.message}
          className="col-start-2"
        />
      </div>
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-2 gap-y-1 text-xs leading-5">
        <PersonalDataConsentCheckbox
          id={personalDataConsentId}
          form={checkoutOrderFormId}
          className="contents text-xs leading-5 [&>label]:row-span-2 [&>label]:w-5 [&>label]:min-w-0 [&>label]:shrink-0 [&>label]:items-start [&>label]:pt-0.5 [&>span]:min-h-0 [&>span]:py-0 [&>span]:pr-0"
          hasError={Boolean(errors.acceptedPersonalDataConsent)}
          aria-describedby={
            errors.acceptedPersonalDataConsent ? "checkout-personal-data-consent-error" : undefined
          }
          {...register("acceptedPersonalDataConsent", {
            onChange: (event) =>
              event.target.checked
                ? analytics.dataConsentChecked()
                : analytics.dataConsentUnchecked(),
          })}
        />
        <FieldError
          id="checkout-personal-data-consent-error"
          message={errors.acceptedPersonalDataConsent?.message}
          className="col-start-2"
        />
      </div>
    </div>
  );
}
