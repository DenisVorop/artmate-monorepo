"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LoaderCircle, LogIn, Tag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Input,
  Label,
} from "@/shared/ui";

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
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch,
    clearErrors,
  } = useForm<PromoCodeFormValues>({
    defaultValues: { code: selectedCode ?? "" },
    resolver: zodResolver(promoCodeFormSchema),
  });
  const codeField = register("code");
  const hasInput = Boolean(watch("code")?.trim());
  const codeError = hasInput ? errors.code : undefined;
  const isApplied = Boolean(
    selectedCode &&
    preview?.code === selectedCode &&
    !isError &&
    !isPending &&
    !isPaused &&
    !isHydrating,
  );

  useEffect(() => {
    reset({ code: selectedCode ?? "" });
    setIsEditing(false);
    if (selectedCode) setIsOpen(true);
  }, [reset, selectedCode]);

  const removeCode = () => {
    clearCode();
    reset({ code: "" });
    setIsEditing(false);
  };

  return (
    <Accordion
      type="single"
      collapsible
      value={isOpen ? "promo" : ""}
      onValueChange={(value) => setIsOpen(value === "promo")}
    >
      <AccordionItem value="promo" className="border-0">
        <AccordionTrigger className="min-h-12 items-center gap-2 py-2 hover:no-underline">
          <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1">Промокод</span>
          {isApplied && <Check className="size-4 text-rose-500" aria-label="Промокод применён" />}
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pt-1 pb-3">
          {isApplied && !isEditing ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 flex-1 text-sm font-semibold tracking-wide break-all">
                {selectedCode}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 px-2 text-xs"
                onClick={() => setIsEditing(true)}
              >
                Изменить
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 text-muted-foreground"
                aria-label="Убрать промокод"
                onClick={removeCode}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <form
              className="space-y-2"
              noValidate
              onSubmit={handleSubmit((values) => {
                const code = normalizePromoCode(values.code);
                if (!code) return;
                applyCode(code);
                setIsEditing(false);
              })}
            >
              <Label htmlFor="promo-code" className="sr-only">
                Промокод
              </Label>
              <div className="flex min-w-0 gap-2">
                <Input
                  id="promo-code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={Boolean(codeError)}
                  aria-describedby={
                    codeError ? "promo-code-error promo-code-status" : "promo-code-status"
                  }
                  placeholder="Введите промокод"
                  disabled={isHydrating}
                  className="min-h-11 min-w-0 flex-1"
                  {...codeField}
                  onChange={(event) => {
                    codeField.onChange(event);
                    if (!event.target.value.trim()) {
                      clearErrors("code");
                      if (selectedCode) clearCode();
                    }
                  }}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!hasInput || isHydrating || (isPending && !isPaused)}
                  className="min-h-11 shrink-0 px-3"
                >
                  {isPending && !isPaused ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : null}
                  {selectedCode ? "Заменить" : "Применить"}
                </Button>
              </div>
              {codeError?.message ? (
                <p id="promo-code-error" className="text-sm text-destructive" role="alert">
                  {codeError.message}
                </p>
              ) : null}
            </form>
          )}

          <div id="promo-code-status" aria-live="polite" className="space-y-2 text-xs leading-5">
            {isHydrating || (isPending && !isPaused) ? (
              <p className="text-muted-foreground">Проверяем промокод…</p>
            ) : null}
            {isPaused ? (
              <p className="text-muted-foreground" role="status">
                Нет сети. Подключитесь к интернету и примените промокод ещё раз.
              </p>
            ) : null}
            {isApplied ? (
              <p className="text-rose-600">Скидка {formatMoney(preview!.discount)}</p>
            ) : null}
            {isError ? (
              <div className="space-y-2" role="alert">
                <p className="text-destructive">{getPromoErrorMessage(error?.message)}</p>
                {isGuest && onLoginRequested ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={onLoginRequested}
                  >
                    <LogIn data-icon="inline-start" />
                    Войти и применить
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          {selectedCode && !isApplied ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 text-muted-foreground"
              aria-label="Убрать промокод"
              onClick={removeCode}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function getPromoErrorMessage(message?: string) {
  return message && /[а-яё]/iu.test(message)
    ? message
    : "Не удалось проверить промокод. Попробуйте ещё раз.";
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}
