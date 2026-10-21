"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { CtaGradientButton } from "@/shared/ui";

import { contactProfileSchema, type ContactProfileValues } from "../../lib/flow-form-values";
import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { primaryButtonClassName } from "./flow-layout";
import { ProfileFields } from "./profile-fields";
import { StepForm } from "./step-form";
import { StepHeading } from "./step-heading";

export function ProfileStep({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "profile" }> & { titleId: string }) {
  const form = useForm<ContactProfileValues>({
    resolver: zodResolver(contactProfileSchema),
    defaultValues: {
      name: props.initialProfile?.name ?? "",
      phone: props.initialProfile?.phone ?? "",
    },
  });

  return (
    <StepForm
      onSubmit={form.handleSubmit(props.onProfile)}
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
      <StepHeading id={titleId}>Ваши данные</StepHeading>
      <ProfileFields
        idPrefix={titleId}
        missingFields={props.missingFields}
        nameField={form.register("name")}
        phoneField={form.register("phone")}
        nameError={form.formState.errors.name?.message}
        phoneError={form.formState.errors.phone?.message}
        disabled={props.isPending}
      />
    </StepForm>
  );
}
