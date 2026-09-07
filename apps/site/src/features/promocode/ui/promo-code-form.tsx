"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, LogIn, Tag } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button, Input, Label } from "@/shared/ui";

import {
  normalizePromoCode,
  promoCodeFormSchema,
  type PromoCodeFormValues,
  usePromocode,
} from "../lib";

export function PromoCodeForm() {
  const {
    applyCode,
    clearCode,
    error,
    isError,
    isGuest,
    isHydrating,
    isPaused,
    isPending,
    onLoginRequested,
    preview,
    selectedCode,
  } = usePromocode();
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<PromoCodeFormValues>({
    defaultValues: { code: selectedCode ?? "" },
    resolver: zodResolver(promoCodeFormSchema),
  });
  const codeField = register("code");

  useEffect(() => {
    reset({ code: selectedCode ?? "" });
  }, [reset, selectedCode]);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <form
        className="space-y-2"
        onSubmit={handleSubmit((values) => applyCode(normalizePromoCode(values.code)))}
      >
        <Label htmlFor="promo-code">Промокод</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="promo-code"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(errors.code)}
            aria-describedby={
              errors.code ? "promo-code-error promo-code-status" : "promo-code-status"
            }
            placeholder="Введите код"
            disabled={isHydrating}
            className="min-h-11"
            {...codeField}
            onChange={(event) => {
              codeField.onChange(event);

              if (selectedCode && !event.target.value.trim()) {
                clearCode();
              }
            }}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={isHydrating || (isPending && !isPaused)}
            className="min-h-11"
          >
            {isPending && !isPaused ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Tag data-icon="inline-start" />
            )}
            {selectedCode ? "Заменить" : "Применить"}
          </Button>
        </div>
        {errors.code?.message ? (
          <p id="promo-code-error" className="text-sm text-destructive" role="alert">
            {errors.code.message}
          </p>
        ) : null}
      </form>

      <div id="promo-code-status" aria-live="polite" className="space-y-2 text-sm">
        {isHydrating ? (
          <p className="text-muted-foreground">Проверяем сохраненный промокод...</p>
        ) : null}
        {isPending && !isPaused ? (
          <p className="text-muted-foreground">Проверяем промокод и сумму скидки...</p>
        ) : null}
        {isPaused ? (
          <p className="text-muted-foreground" role="status">
            Нет сети. Скидка будет доступна после повторной проверки.
          </p>
        ) : null}
        {preview && !isPending ? (
          <p className="font-medium text-emerald-700">
            Промокод {preview.code} применен. Скидка {formatMoney(preview.discount)}.
          </p>
        ) : null}
        {isError ? (
          <div className="space-y-2" role="alert">
            <p className="text-destructive">{error?.message || "Не удалось проверить промокод."}</p>
            {isGuest && onLoginRequested ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={onLoginRequested}
              >
                <LogIn data-icon="inline-start" />
                Войти и проверить
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}
