"use client";

import { Save } from "lucide-react";
import type { ReactNode } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";

import {
  Button,
  Checkbox,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@/shared/ui";

import { generatePromoCode, type PromoCodeFormValues } from "../lib";

type PromoCodeFormProps = {
  readonly codeImmutable?: boolean;
  readonly form: UseFormReturn<PromoCodeFormValues>;
  readonly formId: string;
  readonly onSubmit: () => void;
  readonly submitLabel: string;
  readonly submitPending: boolean;
};

export function PromoCodeForm({
  codeImmutable = false,
  form,
  formId,
  onSubmit,
  submitLabel,
  submitPending,
}: PromoCodeFormProps) {
  const {
    control,
    formState: { errors },
    register,
    watch,
  } = form;
  const type = watch("type");
  const codeInputId = `${formId}-code`;

  const handleGenerateCode = () => {
    if (submitPending || codeImmutable) return;

    form.setValue("code", generatePromoCode(), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <form id={formId} onSubmit={onSubmit}>
      <fieldset
        className="grid min-w-0 gap-5 border-0 p-0"
        disabled={submitPending}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={codeInputId}
            >
              Код
            </label>
            <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                aria-invalid={Boolean(errors.code)}
                disabled={codeImmutable}
                id={codeInputId}
                maxLength={40}
                placeholder="ARTMATE10"
                {...register("code")}
              />
              {!codeImmutable ? (
                <Button
                  className="w-full sm:w-auto"
                  disabled={submitPending}
                  onClick={handleGenerateCode}
                  type="button"
                  variant="outline"
                >
                  Сгенерировать
                </Button>
              ) : null}
            </div>
            {codeImmutable ? (
              <p className="text-xs text-muted-foreground">
                Код нельзя изменить после создания.
              </p>
            ) : null}
            {errors.code?.message ? (
              <span className="text-xs text-destructive">
                {errors.code.message}
              </span>
            ) : null}
          </div>
          <LabeledField error={errors.name?.message} label="Название">
            <Input
              aria-invalid={Boolean(errors.name)}
              maxLength={160}
              {...register("name")}
            />
          </LabeledField>
        </div>

        <LabeledField error={errors.description?.message} label="Описание">
          <Textarea rows={3} {...register("description")} />
        </LabeledField>

        <div className="grid gap-4 lg:grid-cols-3">
          <LabeledField label="Тип скидки">
            <NativeSelect
              className="w-full"
              disabled={submitPending}
              {...register("type")}
            >
              <NativeSelectOption value="percentage">
                Процент
              </NativeSelectOption>
              <NativeSelectOption value="fixed">
                Фиксированная сумма
              </NativeSelectOption>
            </NativeSelect>
          </LabeledField>
          <LabeledField
            error={errors.amount?.message}
            label={type === "percentage" ? "Скидка, %" : "Скидка, ₽"}
          >
            <Input
              aria-invalid={Boolean(errors.amount)}
              inputMode="decimal"
              placeholder={type === "percentage" ? "10" : "500"}
              {...register("amount")}
            />
          </LabeledField>
          {type === "percentage" ? (
            <LabeledField
              error={errors.maxDiscount?.message}
              label="Максимальная скидка, ₽"
            >
              <Input
                inputMode="decimal"
                placeholder="Без ограничения"
                {...register("maxDiscount")}
              />
            </LabeledField>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <LabeledField
            error={errors.minSubtotal?.message}
            label="Минимальная сумма товаров, ₽"
          >
            <Input
              inputMode="decimal"
              placeholder="0"
              {...register("minSubtotal")}
            />
          </LabeledField>
          <LabeledField
            error={errors.maxUses?.message}
            label="Общий лимит применений"
          >
            <Input
              inputMode="numeric"
              placeholder="Без ограничения"
              {...register("maxUses")}
            />
          </LabeledField>
          <LabeledField
            error={errors.maxUsesPerUser?.message}
            label="Лимит на пользователя"
          >
            <Input
              inputMode="numeric"
              placeholder="Без ограничения"
              {...register("maxUsesPerUser")}
            />
          </LabeledField>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <LabeledField
            error={errors.startsAt?.message}
            label="Начало действия, МСК (включительно)"
          >
            <Input
              step="0.001"
              type="datetime-local"
              {...register("startsAt")}
            />
          </LabeledField>
          <LabeledField
            error={errors.endsAt?.message}
            label="Окончание, МСК (не включительно)"
          >
            <Input step="0.001" type="datetime-local" {...register("endsAt")} />
          </LabeledField>
        </div>

        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={field.value}
                disabled={submitPending}
                name={field.name}
                onBlur={field.onBlur}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                ref={field.ref}
              />
              Промокод активен
            </label>
          )}
        />

        <div className="flex justify-end">
          <Button disabled={submitPending} type="submit">
            <Save data-icon="inline-start" aria-hidden="true" />
            {submitLabel}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function LabeledField({
  children,
  error,
  label,
}: {
  readonly children: ReactNode;
  readonly error?: string;
  readonly label: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
