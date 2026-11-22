"use client";
import { useEffect, type ReactNode } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { routes } from "@/shared/constants";
import { Button, Label } from "@/shared/ui";
import { Checkbox } from "@/shared/ui/checkbox";
import { Link } from "@/shared/ui/link";
import type { ContestEntryValues } from "../lib/entry-form";
import type { usePrepareEntryConsent } from "../model/use-prepare-entry-consent";
const confirmations = ["personalDataAccepted", "publicationAccepted"] as const;
function DocumentLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {children}
    </Link>
  );
}
export function EntryConsents({
  form,
  open,
  pending,
  consent,
}: {
  form: UseFormReturn<ContestEntryValues>;
  open: boolean;
  pending: boolean;
  consent: ReturnType<typeof usePrepareEntryConsent>;
}) {
  const { prepare, offer, error, isPending, reset } = consent;
  const values = useWatch({ control: form.control });
  const objectKey = JSON.stringify([values.albumId, values.number, values.caption]);
  useEffect(() => {
    if (open) {
      form.setValue("consentOfferId", "");
      for (const name of confirmations) form.setValue(name, false);
      prepare();
    } else {
      reset();
      form.setValue("consentOfferId", "");
    }
  }, [open, prepare, reset, form]);
  useEffect(() => {
    if (!offer) return;
    form.setValue("consentOfferId", offer.id);
    for (const name of confirmations) form.setValue(name, false);
  }, [offer, form]);
  useEffect(() => {
    for (const name of confirmations) form.setValue(name, false);
  }, [objectKey, values.photo, form]);
  useEffect(() => {
    if (!open || !offer) return;
    const timer = window.setTimeout(
      () => {
        form.setValue("consentOfferId", "");
        for (const name of confirmations) form.setValue(name, false);
        prepare();
      },
      Math.max(0, new Date(offer.validUntil).getTime() - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [open, offer, form, prepare]);
  if (!open) return null;
  if (!offer)
    return (
      <div className="space-y-3 rounded-xl border p-4" aria-live="polite">
        <p>
          {isPending
            ? "Загружаем документы…"
            : error instanceof Error
              ? error.message
              : "Не удалось загрузить документы"}
        </p>
        {!isPending && (
          <Button type="button" variant="outline" onClick={() => prepare()}>
            Попробовать снова
          </Button>
        )}
      </div>
    );
  const errors = form.formState.errors;
  const check = (name: (typeof confirmations)[number], label: ReactNode) => (
    <Controller
      key={name}
      control={form.control}
      name={name}
      render={({ field }) => (
        <div>
          <div className="flex items-start gap-3 py-2">
            <Checkbox
              id={`contest-${name}`}
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              onBlur={field.onBlur}
              ref={field.ref}
              aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `contest-${name}-error` : undefined}
              disabled={pending || isPending}
              className="mt-1"
            />
            <Label htmlFor={`contest-${name}`} className="block text-sm leading-6 font-normal">
              {label}
            </Label>
          </div>
          {errors[name] && (
            <p id={`contest-${name}-error`} role="alert" className="text-sm text-red-700">
              {errors[name]?.message}
            </p>
          )}
        </div>
      )}
    />
  );
  return (
    <fieldset disabled={pending} className="space-y-5 border-t border-rose-100 pt-6">
      <legend className="sr-only">Согласия</legend>
      <input type="hidden" {...form.register("consentOfferId")} />
      <div className="space-y-1">
        {check(
          "personalDataAccepted",
          <>
            Даю{" "}
            <DocumentLink href={routes.legal.contestPersonalDataConsent}>
              согласие на обработку персональных данных
            </DocumentLink>
          </>,
        )}
        {check(
          "publicationAccepted",
          <>
            Даю{" "}
            <DocumentLink href={routes.legal.contestPublicationConsent}>
              согласие на публикацию работы
            </DocumentLink>
          </>,
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error instanceof Error ? error.message : "Не удалось обновить документы"}
        </p>
      )}
      {(error || errors.root) && (
        <Button
          type="button"
          variant="link"
          className="px-0"
          disabled={pending || isPending}
          onClick={() => {
            form.setValue("consentOfferId", "");
            for (const name of confirmations) form.setValue(name, false);
            form.clearErrors("root");
            prepare();
          }}
        >
          Обновить документы
        </Button>
      )}
    </fieldset>
  );
}
