"use client";

import { ArrowRight } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { routes } from "@/shared/constants";
import { CtaGradientButton, Label } from "@/shared/ui";
import { Checkbox } from "@/shared/ui/checkbox";
import { Link } from "@/shared/ui/link";

import { consentDecisionSchema, type ConsentDecisionValues } from "../../lib/flow-form-values";
import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { BenefitsPanel } from "./benefits-panel";
import { flowGridClassName, primaryButtonClassName } from "./flow-layout";
import { FormError } from "./form-error";
import { StepHeading } from "./step-heading";
import { VerifiedStatus } from "./verified-status";

const checkboxClassName =
  "size-5 border-stone-400 bg-white data-checked:border-rose-500 data-checked:bg-rose-500 data-checked:text-white focus-visible:ring-rose-300";
const documentLinkClassName =
  "text-rose-600 no-underline hover:text-rose-500 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-rose-300";

export function ConsentsStep({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "consents" }> & { titleId: string }) {
  const form = useForm<ConsentDecisionValues>({
    resolver: zodResolver(consentDecisionSchema),
    defaultValues: { advertising: false, personalData: true },
  });
  const personalDataId = `${titleId}-personal-data`;
  const advertisingId = `${titleId}-advertising`;

  return (
    <form className={flowGridClassName} onSubmit={form.handleSubmit(props.onConsents)} noValidate>
      <div className="flex min-w-0 flex-col pt-2 sm:min-h-60">
        <VerifiedStatus via={props.verifiedVia} />
        <StepHeading id={titleId}>
          Завершим <span className="sm:block">вход?</span>
        </StepHeading>
        <div className="mt-9 flex items-start gap-3 sm:mt-auto sm:pt-9">
          <Controller
            name="advertising"
            control={form.control}
            render={({ field }) => (
              <Checkbox
                id={advertisingId}
                checked={field.value}
                onCheckedChange={(value) => field.onChange(value === true)}
                onBlur={field.onBlur}
                ref={field.ref}
                disabled={props.isPending}
                className={`${checkboxClassName} mt-0.5 rounded-[5px]`}
              />
            )}
          />
          <Label
            htmlFor={advertisingId}
            className="block min-w-0 text-sm leading-6 font-normal text-stone-800"
          >
            Даю согласие на получение{" "}
            <Link
              href={routes.legal.advertisingConsent}
              target="_blank"
              rel="noopener noreferrer"
              className={`${documentLinkClassName} inline-block`}
            >
              рекламных писем
            </Link>{" "}
            Artmate
          </Label>
        </div>
      </div>
      <BenefitsPanel
        className="sm:col-start-2 sm:row-span-2 sm:row-start-1"
        personalDataChoice={
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <Controller
                name="personalData"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Checkbox
                    id={personalDataId}
                    checked={field.value}
                    onCheckedChange={(value) => field.onChange(value === true)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    disabled={props.isPending}
                    aria-invalid={!!fieldState.error}
                    aria-describedby={fieldState.error ? `${personalDataId}-error` : undefined}
                    className={`${checkboxClassName} mt-0.5 rounded-full`}
                  />
                )}
              />
              <Label
                htmlFor={personalDataId}
                className="block min-w-0 text-sm leading-6 font-normal text-stone-800"
              >
                Даю{" "}
                <Link
                  href={routes.legal.personalDataConsent}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={documentLinkClassName}
                >
                  согласие на обработку персональных данных
                </Link>
              </Label>
            </div>
            <FormError
              id={`${personalDataId}-error`}
              message={form.formState.errors.personalData?.message}
            />
          </div>
        }
      />
      <div className="space-y-3 sm:col-start-1 sm:row-start-2 sm:self-end">
        <FormError message={props.error} />
        <CtaGradientButton
          type="submit"
          className={primaryButtonClassName}
          disabled={props.isPending}
        >
          Продолжить
          <ArrowRight aria-hidden className="size-4" />
        </CtaGradientButton>
      </div>
    </form>
  );
}
