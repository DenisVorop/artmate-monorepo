"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { CtaGradientButton } from "@/shared/ui";

import { registrationSchema, type RegistrationValues } from "../../lib/flow-form-values";
import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { primaryButtonClassName } from "./flow-layout";
import { PasswordFields } from "./password-fields";
import { ProfileFields } from "./profile-fields";
import { StepForm } from "./step-form";
import { StepHeading } from "./step-heading";

export function RegistrationStep({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "registration" }> & { titleId: string }) {
  const form = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: props.initialProfile?.name ?? "",
      phone: props.initialProfile?.phone ?? "",
      password: "",
      passwordConfirm: "",
    },
  });

  return (
    <StepForm
      onSubmit={form.handleSubmit(props.onRegistration)}
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
      <StepHeading id={titleId}>Создать аккаунт</StepHeading>
      <ProfileFields
        idPrefix={titleId}
        missingFields={props.missingFields}
        nameField={form.register("name")}
        phoneField={form.register("phone")}
        nameError={form.formState.errors.name?.message}
        phoneError={form.formState.errors.phone?.message}
        disabled={props.isPending}
      />
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
