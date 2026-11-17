"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button, CtaGradientButton, Input, Label } from "@/shared/ui";

import { passwordLoginSchema, type PasswordLoginValues } from "../../lib/flow-form-values";
import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { fieldInputClassName, primaryButtonClassName } from "./flow-layout";
import { FormError } from "./form-error";
import { PasswordInput } from "./password-input";
import { ProviderButtons } from "./provider-buttons";
import { StepForm } from "./step-form";
import { StepHeading } from "./step-heading";

export function LoginStep({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "login" }> & { titleId: string }) {
  const form = useForm<PasswordLoginValues>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: props.initialEmail ?? "", password: "" },
  });
  const emailId = `${titleId}-email`;
  const passwordId = `${titleId}-password`;

  return (
    <StepForm
      onSubmit={form.handleSubmit(props.onLogin)}
      isPending={props.isPending}
      error={props.error}
      actions={
        <>
          <CtaGradientButton
            type="submit"
            className={primaryButtonClassName}
            disabled={props.isPending}
          >
            Войти
          </CtaGradientButton>
          <p className="flex flex-wrap items-center justify-center gap-1 text-sm leading-6 text-stone-500">
            Нет аккаунта?
            <Button
              type="button"
              variant="link"
              className="h-auto min-h-11 px-1 text-stone-500 hover:text-stone-700"
              onClick={props.onSignup}
              disabled={props.isPending}
            >
              Зарегистрироваться
            </Button>
          </p>
          <ProviderButtons onYandex={props.onYandex} disabled={props.isPending} />
        </>
      }
    >
      <StepHeading id={titleId}>Войти</StepHeading>
      {props.emailCodeConfirmed && (
        <p role="status" className="text-sm leading-6 text-stone-700">
          Код принят. Введите пароль, чтобы войти.
        </p>
      )}
      <div className="space-y-2">
        <div data-auth-field className="space-y-1">
          <Label htmlFor={emailId}>Электронная почта</Label>
          <Input
            {...form.register("email")}
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="username"
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
        <div data-auth-field className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <Label htmlFor={passwordId}>Пароль</Label>
            <Button
              type="button"
              variant="link"
              className="relative h-auto min-h-0 p-0 text-xs leading-6 font-normal text-stone-500 after:absolute after:inset-x-0 after:-inset-y-2.5 hover:text-stone-700"
              onClick={props.onRecovery}
              disabled={props.isPending}
            >
              Забыли пароль?
            </Button>
          </div>
          <PasswordInput
            {...form.register("password")}
            id={passwordId}
            autoComplete="current-password"
            placeholder="Введите пароль"
            disabled={props.isPending}
            aria-invalid={!!form.formState.errors.password}
            aria-describedby={form.formState.errors.password ? `${passwordId}-error` : undefined}
          />
          <FormError
            reserveSpace
            id={`${passwordId}-error`}
            message={form.formState.errors.password?.message}
          />
        </div>
      </div>
    </StepForm>
  );
}
