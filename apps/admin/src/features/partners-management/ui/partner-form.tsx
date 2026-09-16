"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { AffiliatePartner } from "@/entities/affiliate-partners";
import type { PartnerApplication } from "@/entities/partner-applications";
import type { AdminUser } from "@/entities/users";
import {
  Button,
  DialogFooter,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@/shared/ui";

import {
  affiliatePartnerFormSchema,
  getAffiliatePartnerFormValues,
  getAffiliatePartnerInput,
  getTodayDateInputValue,
  type AffiliatePartnerFormValues,
} from "../lib";
import { useSaveAffiliatePartner } from "../model";

type PartnerFormProps = {
  readonly applications: readonly PartnerApplication[];
  readonly applicationsDisabled: boolean;
  readonly onSaved: () => void;
  readonly onPendingChange: (pending: boolean) => void;
  readonly partner?: AffiliatePartner;
  readonly users: readonly AdminUser[];
};

export function PartnerForm({
  applications,
  applicationsDisabled,
  onPendingChange,
  onSaved,
  partner,
  users,
}: PartnerFormProps) {
  const submittingRef = useRef(false);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<AffiliatePartnerFormValues>({
    resolver: zodResolver(affiliatePartnerFormSchema),
    defaultValues: getAffiliatePartnerFormValues(partner),
  });
  const { error, isPending, mutate } = useSaveAffiliatePartner({
    onSuccess: () => {
      submittingRef.current = false;
      onSaved();
    },
  });

  useEffect(
    () => reset(getAffiliatePartnerFormValues(partner)),
    [partner, reset],
  );
  useEffect(() => {
    onPendingChange(isPending);
    return () => onPendingChange(false);
  }, [isPending, onPendingChange]);

  const submit = handleSubmit((values) => {
    if (isPending || submittingRef.current) return;
    const userId = partner?.userId ?? values.userId;
    if (!userId) return;
    submittingRef.current = true;
    mutate(
      {
        input: getAffiliatePartnerInput(values, {
          originalSignedAt: partner?.contract.signedAt,
          partnerApplicationIdOverride:
            applicationsDisabled && partner
              ? partner.partnerApplicationId
              : undefined,
        }),
        userId,
      },
      {
        onSettled: () => {
          submittingRef.current = false;
        },
      },
    );
  });

  return (
    <form className="min-w-0 space-y-4" onSubmit={submit}>
      {!partner ? (
        <Field label="Пользователь" error={errors.userId?.message}>
          <NativeSelect disabled={isPending} {...register("userId")}>
            <NativeSelectOption value="">
              Выберите пользователя
            </NativeSelectOption>
            {users.map((user) => (
              <NativeSelectOption key={user.id} value={user.id}>
                {getUserOptionLabel(user)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Статус" error={errors.status?.message}>
          <NativeSelect disabled={isPending} {...register("status")}>
            <NativeSelectOption value="active">Активен</NativeSelectOption>
            <NativeSelectOption value="suspended">
              Приостановлен
            </NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field label="Заявка" error={errors.partnerApplicationId?.message}>
          <NativeSelect
            disabled={isPending || applicationsDisabled}
            {...register("partnerApplicationId")}
          >
            <NativeSelectOption value="">Без заявки</NativeSelectOption>
            {applications.map((application) => (
              <NativeSelectOption key={application.id} value={application.id}>
                {application.name} · {application.email}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Номер договора" error={errors.contractNumber?.message}>
          <Input
            disabled={isPending}
            maxLength={120}
            {...register("contractNumber")}
          />
        </Field>
        <Field label="Дата подписания" error={errors.signedAt?.message}>
          <Input
            disabled={isPending}
            max={getTodayDateInputValue()}
            type="date"
            {...register("signedAt")}
          />
        </Field>
      </div>
      <Field
        label="Минимальная выплата, ₽"
        hint="Оставьте пустым, чтобы использовать базовый минимум 5 000 ₽"
        error={errors.minimumPayoutRubles?.message}
      >
        <Input
          disabled={isPending}
          inputMode="decimal"
          placeholder="5000,00"
          {...register("minimumPayoutRubles")}
        />
      </Field>
      <Field label="Платёжные реквизиты" error={errors.paymentDetails?.message}>
        <Textarea
          className="min-h-32 min-w-0 whitespace-pre-wrap break-words"
          disabled={isPending}
          {...register("paymentDetails")}
        />
      </Field>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Доступ в кабинет откроется после сохранения полного профиля с договором.
      </p>
      <DialogFooter>
        <Button disabled={isPending} type="submit">
          {isPending ? "Сохраняем…" : "Сохранить профиль"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  children,
  error,
  hint,
  label,
}: {
  readonly children: ReactNode;
  readonly error?: string;
  readonly hint?: string;
  readonly label: string;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium">
      {label}
      {children}
      {hint ? (
        <span className="text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="text-xs font-normal text-destructive">{error}</span>
      ) : null}
    </label>
  );
}

function getUserOptionLabel(user: AdminUser) {
  if (user.name && user.email) {
    return `${user.name} · ${user.email}`;
  }

  return user.name ?? user.email ?? user.id;
}
