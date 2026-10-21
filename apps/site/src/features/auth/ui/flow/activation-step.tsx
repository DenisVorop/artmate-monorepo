"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { CtaGradientButton } from "@/shared/ui";

import { passwordCreationSchema, type PasswordCreationValues } from "../../lib/flow-form-values";
import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { primaryButtonClassName } from "./flow-layout";
import { PasswordFields } from "./password-fields";
import { StepForm } from "./step-form";
import { StepHeading } from "./step-heading";

export function ActivationStep({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "activation" }> & { titleId: string }) {
  const form = useForm<PasswordCreationValues>({
    resolver: zodResolver(passwordCreationSchema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  return (
    <StepForm
      onSubmit={form.handleSubmit(props.onActivation)}
      isPending={props.isPending}
      error={props.error}
      actions={
        <>
          <CtaGradientButton
            type="submit"
            className={primaryButtonClassName}
            disabled={props.isPending}
          >
            Продолжить
          </CtaGradientButton>
        </>
      }
    >
      <div>
        <StepHeading id={titleId}>Завершите регистрацию</StepHeading>
        <p className="mt-3 text-sm leading-6 text-stone-500">
          Придумайте пароль для входа в аккаунт.
        </p>
      </div>
      <PasswordFields
        idPrefix={titleId}
        passwordField={form.register("password")}
        confirmationField={form.register("passwordConfirm")}
        passwordError={form.formState.errors.password?.message}
        confirmationError={form.formState.errors.passwordConfirm?.message}
        disabled={props.isPending}
      />
    </StepForm>
  );
}
