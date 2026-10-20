"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button, CtaGradientButton, Input, Label } from "@/shared/ui";

import { emailCodeRequestSchema, type EmailCodeRequestValues } from "../../lib/flow-form-values";
import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { fieldInputClassName, primaryButtonClassName, stepFormClassName } from "./flow-layout";
import { FormError } from "./form-error";
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
  const errorId = `${fieldId}-error`;

  return (
    <form className={stepFormClassName} onSubmit={form.handleSubmit(props.onEmail)} noValidate>
      <div className="space-y-3">
        <StepHeading id={titleId}>Войти в Artmate</StepHeading>
        <p className="text-sm leading-6 text-stone-500">Укажите почту для входа или регистрации.</p>
      </div>
      <div className="space-y-2">
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
          aria-describedby={form.formState.errors.email ? errorId : undefined}
        />
        <FormError id={errorId} message={form.formState.errors.email?.message} />
      </div>
      <FormError message={props.error} />
      <CtaGradientButton
        type="submit"
        className={primaryButtonClassName}
        disabled={props.isPending}
      >
        Получить код
        <ArrowRight aria-hidden className="size-4" />
      </CtaGradientButton>
      <div className="flex items-center gap-3 text-xs leading-5 text-stone-500 before:h-px before:flex-1 before:bg-stone-200 after:h-px after:flex-1 after:bg-stone-200">
        или войти с помощью
      </div>
      <div
        role="group"
        aria-label="Вход через другие сервисы"
        className="grid grid-cols-[repeat(4,44px)] justify-start gap-3"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-xl p-0.5"
          aria-label="Войти с Яндекс ID"
          onClick={props.onYandex}
          disabled={props.isPending}
        >
          <Image src="/images/auth/yandex-id.svg" alt="" width={40} height={40} />
        </Button>
      </div>
    </form>
  );
}
