"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Controller, useForm } from "react-hook-form";

import { Button, CtaGradientButton, Label } from "@/shared/ui";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/shared/ui/input-otp";

import { emailCodeConfirmSchema, type EmailCodeConfirmValues } from "../../lib/flow-form-values";
import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { primaryButtonClassName } from "./flow-layout";
import { FormError } from "./form-error";
import { StepHeading } from "./step-heading";
import { StepForm } from "./step-form";

export function CodeStep({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "code" }> & { titleId: string }) {
  const form = useForm<EmailCodeConfirmValues>({
    resolver: zodResolver(emailCodeConfirmSchema),
    defaultValues: { code: "" },
  });
  const inputId = `${titleId}-code`;
  const errorId = `${inputId}-error`;
  const resendTime = `${String(Math.floor(props.resendSeconds / 60)).padStart(2, "0")}:${String(
    props.resendSeconds % 60,
  ).padStart(2, "0")}`;

  return (
    <StepForm
      onSubmit={form.handleSubmit(props.onCode)}
      isPending={props.isPending}
      reserveErrorSpace={false}
      actions={
        <CtaGradientButton
          type="submit"
          className={primaryButtonClassName}
          disabled={props.isPending}
        >
          Подтвердить почту
          <ArrowRight aria-hidden className="size-4" />
        </CtaGradientButton>
      }
    >
      <Button
        type="button"
        variant="link"
        className="h-auto min-h-11 self-start px-0 text-xs text-stone-500 hover:text-stone-700"
        onClick={props.onBack}
        disabled={props.isPending}
      >
        <ArrowLeft aria-hidden />
        Изменить почту
      </Button>
      <div className="space-y-3">
        <StepHeading id={titleId}>Код из письма</StepHeading>
        <p className="text-sm leading-6 text-stone-500">
          Отправили код на{" "}
          <span className="block font-semibold wrap-anywhere text-stone-800">{props.email}</span>
        </p>
      </div>
      <div data-auth-field className="space-y-1">
        <Label htmlFor={inputId} className="sr-only">
          Код из письма
        </Label>
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <InputOTP
              {...field}
              id={inputId}
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              autoComplete="one-time-code"
              pushPasswordManagerStrategy="none"
              containerClassName="w-full"
              disabled={props.isPending}
              aria-invalid={!!fieldState.error || !!props.error}
              aria-describedby={fieldState.error || props.error ? errorId : undefined}
            >
              <InputOTPGroup className="grid w-full grid-cols-6 gap-1.5">
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="h-12 w-full rounded-lg border text-xl first:rounded-lg last:rounded-lg"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          )}
        />
        <FormError
          reserveSpace
          className="min-h-8"
          id={errorId}
          message={form.formState.errors.code?.message ?? props.error}
        />
      </div>
      <Button
        type="button"
        variant="link"
        className="h-auto min-h-11 self-start px-0 text-xs text-stone-500 hover:text-stone-700"
        onClick={props.onResend}
        disabled={props.isPending || props.resendSeconds > 0}
      >
        {props.resendSeconds > 0 ? `Новый код через ${resendTime}` : "Отправить код ещё раз"}
      </Button>
    </StepForm>
  );
}
