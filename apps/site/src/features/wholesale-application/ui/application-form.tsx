"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, Check, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { routes } from "@/shared/constants";
import { Button, Input, Label, PersonalDataConsentCheckbox, Textarea } from "@/shared/ui";

import {
  wholesaleApplicationDefaults,
  wholesaleApplicationSchema,
  type WholesaleApplicationValues,
} from "../lib/form-values";
import { useSubmitApplication } from "../model/use-submit-application";

const inputClassName =
  "h-11 border-stone-200 bg-stone-50 px-3 text-base text-stone-950 placeholder:text-stone-400 focus-visible:border-rose-500 focus-visible:ring-rose-500/15 md:text-sm";

export function WholesaleApplicationForm() {
  const [sent, setSent] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formId = useId();
  const { submitApplication, isPending, error, reset: resetSubmission } = useSubmitApplication();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WholesaleApplicationValues>({
    defaultValues: wholesaleApplicationDefaults,
    resolver: zodResolver(wholesaleApplicationSchema),
  });

  useEffect(() => {
    if (sent) titleRef.current?.focus();
  }, [sent]);

  const submit = handleSubmit(async (values) => {
    try {
      await submitApplication(values);
      reset();
      setSent(true);
    } catch {
      // Keep the entered values so the visitor can retry.
    }
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-white p-5 text-stone-950 shadow-2xl shadow-black/25 sm:p-7 lg:p-8">
      {sent ? (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-120 flex-col items-start justify-center"
        >
          <span className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <Check aria-hidden className="size-7" />
          </span>
          <h3
            ref={titleRef}
            tabIndex={-1}
            className="text-3xl font-extrabold tracking-tight outline-none"
          >
            Заявка отправлена
          </h3>
          <p className="mt-4 max-w-sm leading-7 text-stone-600">
            Изучим вашу задачу и ответим на указанную почту, чтобы обсудить оптовые условия.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-8 h-12 rounded-xl px-5"
            onClick={() => {
              resetSubmission();
              setSent(false);
            }}
          >
            Отправить ещё одну заявку
          </Button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={submit}
          aria-label="Заявка на оптовый заказ"
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor={`${formId}-company`} className="text-sm font-bold">
              Компания
            </Label>
            <Input
              id={`${formId}-company`}
              autoComplete="organization"
              placeholder="Название компании или проекта"
              maxLength={80}
              disabled={isPending}
              className={inputClassName}
              aria-required="true"
              aria-invalid={Boolean(errors.company)}
              aria-describedby={errors.company ? `${formId}-company-error` : undefined}
              {...register("company")}
            />
            <FieldError id={`${formId}-company-error`} message={errors.company?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-email`} className="text-sm font-bold">
              Электронная почта
            </Label>
            <Input
              id={`${formId}-email`}
              type="email"
              autoComplete="email"
              placeholder="hello@company.ru"
              maxLength={254}
              disabled={isPending}
              className={inputClassName}
              aria-required="true"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${formId}-email-error` : undefined}
              {...register("email")}
            />
            <FieldError id={`${formId}-email-error`} message={errors.email?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-task`} className="text-sm font-bold">
              О задаче
            </Label>
            <Textarea
              id={`${formId}-task`}
              rows={4}
              maxLength={2000}
              disabled={isPending}
              placeholder="Какие раскраски вас интересуют, примерный тираж и желаемые сроки"
              className={`${inputClassName} min-h-36 resize-y py-3 leading-6`}
              aria-required="true"
              aria-invalid={Boolean(errors.task)}
              aria-describedby={errors.task ? `${formId}-task-error` : undefined}
              {...register("task")}
            />
            <FieldError id={`${formId}-task-error`} message={errors.task?.message} />
          </div>
          <div>
            <PersonalDataConsentCheckbox
              id={`${formId}-consent`}
              className="border-transparent bg-transparent p-0 text-xs"
              hasError={Boolean(errors.acceptedPersonalDataConsent)}
              disabled={isPending}
              aria-describedby={
                errors.acceptedPersonalDataConsent ? `${formId}-consent-error` : undefined
              }
              {...register("acceptedPersonalDataConsent")}
            />
            <FieldError
              id={`${formId}-consent-error`}
              message={errors.acceptedPersonalDataConsent?.message}
            />
          </div>
          <Button
            type="submit"
            disabled={isPending}
            className="h-12 w-full justify-between bg-linear-to-r from-rose-500 to-orange-400 px-5 text-base font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500 focus-visible:ring-rose-500/40"
          >
            {isPending ? "Отправляем заявку" : "Отправить заявку"}
            {isPending ? (
              <LoaderCircle
                aria-hidden
                className="size-5 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <ArrowUpRight aria-hidden className="size-5" />
            )}
          </Button>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800"
            >
              Не удалось отправить заявку. Попробуйте ещё раз или{" "}
              <a href={routes.contacts} className="underline underline-offset-2">
                свяжитесь с нами
              </a>
              .
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}

function FieldError({ id, message }: { readonly id: string; readonly message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-sm text-rose-700">
      {message}
    </p>
  ) : null;
}
