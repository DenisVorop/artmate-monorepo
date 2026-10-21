"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button, CtaGradientButton, Input, Label } from "@/shared/ui";

import { emailCodeRequestSchema, type EmailCodeRequestValues } from "../../lib/flow-form-values";
import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { fieldInputClassName, primaryButtonClassName } from "./flow-layout";
import { FormError } from "./form-error";
import { ProviderButtons } from "./provider-buttons";
import { StepForm } from "./step-form";
import { StepHeading } from "./step-heading";

export function EmailStep({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "email" }> & { titleId: string }) {
  const form = useForm<EmailCodeRequestValues>({
    resolver: zodResolver(emailCodeRequestSchema),
    defaultValues: { email: props.initialEmail ?? "" },
  });
  const fieldId = `${titleId}-email`;

  return (
    <StepForm
      onSubmit={form.handleSubmit(props.onEmail)}
      isPending={props.isPending}
      error={props.error}
      actions={
        <>
          <CtaGradientButton
            type="submit"
            className={primaryButtonClassName}
            disabled={props.isPending}
          >
            Получить код
          </CtaGradientButton>
          <p className="flex flex-wrap items-center justify-center gap-1 text-sm leading-6 text-stone-500">
            Уже есть аккаунт?
            <Button
              type="button"
              variant="link"
              className="h-auto min-h-11 px-1 text-stone-900 hover:text-stone-700"
              onClick={props.onLogin}
              disabled={props.isPending}
            >
              Войти
            </Button>
          </p>
          <ProviderButtons onYandex={props.onYandex} disabled={props.isPending} />
        </>
      }
    >
      <StepHeading id={titleId}>Создать аккаунт</StepHeading>
      <div data-auth-field className="space-y-1">
        <Label htmlFor={fieldId}>Электронная почта</Label>
        <Input
          {...form.register("email")}
          id={fieldId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          className={fieldInputClassName}
          disabled={props.isPending}
          aria-invalid={!!form.formState.errors.email}
          aria-describedby={form.formState.errors.email ? `${fieldId}-error` : undefined}
        />
        <FormError
          reserveSpace
          id={`${fieldId}-error`}
          message={form.formState.errors.email?.message}
        />
      </div>
    </StepForm>
  );
}
