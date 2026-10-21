"use client";

import { ArrowLeft } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button, CtaGradientButton, Input, Label } from "@/shared/ui";

import { emailCodeRequestSchema, type EmailCodeRequestValues } from "../../lib/flow-form-values";
import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { fieldInputClassName, primaryButtonClassName } from "./flow-layout";
import { FormError } from "./form-error";
import { StepForm } from "./step-form";
import { StepHeading } from "./step-heading";

export function RecoveryStep({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "recovery" }> & { titleId: string }) {
  const form = useForm<EmailCodeRequestValues>({
    resolver: zodResolver(emailCodeRequestSchema),
    defaultValues: { email: props.initialEmail ?? "" },
  });
  const emailId = `${titleId}-email`;

  return (
    <StepForm
      onSubmit={form.handleSubmit(props.onRecovery)}
      isPending={props.isPending}
      error={props.error}
      actions={
        <>
          <CtaGradientButton
            type="submit"
            className={primaryButtonClassName}
            disabled={props.isPending}
          >
            Отправить ссылку
          </CtaGradientButton>
        </>
      }
    >
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-h-11 px-0 text-xs text-stone-500 hover:text-stone-700"
        onClick={props.onLogin}
        disabled={props.isPending}
      >
        <ArrowLeft aria-hidden />
        Вернуться ко входу
      </Button>
      <div>
        <StepHeading id={titleId}>Восстановить доступ</StepHeading>
        <p className="mt-3 text-sm leading-6 text-stone-500">
          Пришлём письмо для восстановления доступа.
        </p>
      </div>
      <div data-auth-field className="space-y-1">
        <Label htmlFor={emailId}>Электронная почта</Label>
        <Input
          {...form.register("email")}
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          className={fieldInputClassName}
          disabled={props.isPending}
          aria-invalid={!!form.formState.errors.email}
          aria-describedby={form.formState.errors.email ? `${emailId}-error` : undefined}
        />
        <FormError
          reserveSpace
          id={`${emailId}-error`}
          message={form.formState.errors.email?.message}
        />
      </div>
    </StepForm>
  );
}
