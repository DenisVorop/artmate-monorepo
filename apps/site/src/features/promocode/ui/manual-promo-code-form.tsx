"use client";
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { LoaderCircle } from "lucide-react";
import { CtaGradientButton, DrawerBody, DrawerFooter, Input, Label } from "@/shared/ui";
import { useAnalytics } from "../lib/analytics";
import { normalizePromoCode } from "../lib/promo-code";
import type { PromoCodeFormValues } from "../lib/promo-code-form";
import { usePromocode } from "../lib/promo-code-provider";
import { PromoCodeStatus } from "./promo-code-status";

export function ManualPromoCodeForm({
  form,
  onClose,
}: {
  form: UseFormReturn<PromoCodeFormValues>;
  onClose: () => void;
}) {
  const promo = usePromocode(),
    analytics = useAnalytics();
  const {
    register,
    watch,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting },
  } = form;
  const field = register("code");
  const hasInput = Boolean(watch("code")?.trim());
  const error = hasInput ? errors.code : undefined;
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    form.setFocus("code");
    return () => {
      active.current = false;
    };
  }, [form]);
  const pending = (isSubmitting || promo.isPending) && !promo.isPaused;
  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={handleSubmit(async (values) => {
        const code = normalizePromoCode(values.code);
        if (!code) return;
        if (promo.selectedCode && promo.selectedCode !== code) analytics.replaced();
        else analytics.submitted();
        if ((await promo.applyCode(code)) && active.current) onClose();
      })}
    >
      <DrawerBody className="space-y-4 px-5 py-4">
        <Label htmlFor="promo-code" className="sr-only">
          Промокод
        </Label>
        <Input
          id="promo-code"
          placeholder="Введите промокод"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="min-h-12"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "promo-code-error promo-code-status" : "promo-code-status"}
          disabled={promo.isHydrating || pending}
          {...field}
          onChange={(event) => {
            field.onChange(event);
            if (!event.target.value.trim()) {
              clearErrors("code");
              if (promo.selectedCode) {
                analytics.removed();
                promo.clearCode();
              }
            }
          }}
        />
        {error?.message && (
          <p id="promo-code-error" role="alert" className="text-sm text-destructive">
            {error.message}
          </p>
        )}
        <PromoCodeStatus
          id="promo-code-status"
          onLogin={() => {
            onClose();
            promo.onLoginRequested?.();
          }}
        />
      </DrawerBody>
      <DrawerFooter className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <CtaGradientButton
          type="submit"
          disabled={!hasInput || promo.isHydrating || pending}
          className="min-h-12 w-full gap-2"
        >
          {pending && (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          )}
          {pending ? "Проверяем…" : "Применить"}
        </CtaGradientButton>
      </DrawerFooter>
    </form>
  );
}
