"use client";

import { ArrowRight } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { CtaGradientButton, Input, Label } from "@/shared/ui";

import { contactProfileSchema, type ContactProfileValues } from "../../lib/flow-form-values";
import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { fieldInputClassName, primaryButtonClassName, stepFormClassName } from "./flow-layout";
import { FormError } from "./form-error";
import { StepHeading } from "./step-heading";
import { VerifiedStatus } from "./verified-status";

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
    <form className={stepFormClassName} onSubmit={form.handleSubmit(props.onProfile)} noValidate>
      <div>
        <VerifiedStatus via={props.verifiedVia} />
        <StepHeading id={titleId}>Ваши данные</StepHeading>
        <p className="mt-3 text-sm leading-6 text-stone-500">Добавьте имя и телефон в аккаунт.</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${titleId}-name`}>ФИО</Label>
          <Input
            {...form.register("name")}
            id={`${titleId}-name`}
            autoComplete="name"
            maxLength={120}
            placeholder="Фамилия, имя, отчество"
            className={fieldInputClassName}
            disabled={props.isPending}
            aria-invalid={!!form.formState.errors.name}
            aria-describedby={form.formState.errors.name ? `${titleId}-name-error` : undefined}
          />
          <FormError id={`${titleId}-name-error`} message={form.formState.errors.name?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${titleId}-phone`}>Номер телефона</Label>
          <Input
            {...form.register("phone")}
            id={`${titleId}-phone`}
            type="tel"
            autoComplete="tel"
            maxLength={80}
            placeholder="+7 (___) ___-__-__"
            className={fieldInputClassName}
            disabled={props.isPending}
            aria-invalid={!!form.formState.errors.phone}
            aria-describedby={form.formState.errors.phone ? `${titleId}-phone-error` : undefined}
          />
          <FormError id={`${titleId}-phone-error`} message={form.formState.errors.phone?.message} />
        </div>
      </div>
      <FormError message={props.error} />
      <CtaGradientButton
        type="submit"
        className={`${primaryButtonClassName} mt-auto`}
        disabled={props.isPending}
      >
        Продолжить
        <ArrowRight aria-hidden className="size-4" />
      </CtaGradientButton>
    </form>
  );
}
