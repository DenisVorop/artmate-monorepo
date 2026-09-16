"use client";

import { LoaderCircle, RefreshCw, WandSparkles } from "lucide-react";
import { useId } from "react";
import { Controller } from "react-hook-form";

import type { AffiliateCode } from "@/entities/affiliate-code";
import { Button, Input, Textarea } from "@/shared/ui";

import { useAffiliateCodeForm } from "../lib";
import { CommissionSplit } from "./commission-split";

type CodeFormProps =
  | {
      readonly code?: never;
      readonly mode: "create";
      readonly onComplete: () => void;
      readonly onCancel?: never;
    }
  | {
      readonly code: AffiliateCode;
      readonly mode: "edit";
      readonly onCancel: () => void;
      readonly onComplete: () => void;
    };

export function CodeForm(props: CodeFormProps) {
  const formId = useId();
  const { form, generateCode, isPending, onSubmit } =
    useAffiliateCodeForm(props);

  return (
    <form className="min-w-0 max-w-full" noValidate onSubmit={onSubmit}>
      <fieldset
        className="grid min-w-0 max-w-full gap-6 border-0 p-0"
        disabled={isPending}
      >
        {props.mode === "create" ? (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                className="text-sm font-extrabold text-ink"
                htmlFor={`${formId}-code`}
              >
                Код
              </label>
              <Button
                disabled={isPending}
                onClick={generateCode}
                size="sm"
                type="button"
                variant="ghost"
              >
                <WandSparkles aria-hidden="true" />
                Сгенерировать
              </Button>
            </div>
            <Input
              aria-invalid={Boolean(form.formState.errors.code)}
              autoComplete="off"
              className="mt-2 font-mono uppercase placeholder:normal-case"
              id={`${formId}-code`}
              aria-describedby={`${formId}-code-description`}
              maxLength={40}
              placeholder="Например, ARTM-SUMMER"
              {...form.register("code", {
                onChange: () => form.clearErrors("root"),
              })}
            />
            {form.formState.errors.code ? (
              <p
                className="mt-2 text-sm text-destructive"
                id={`${formId}-code-description`}
              >
                {form.formState.errors.code.message}
              </p>
            ) : (
              <p
                className="mt-2 text-xs leading-5 text-muted-foreground"
                id={`${formId}-code-description`}
              >
                3–40 латинских букв, цифр, _ или -. После создания код не
                меняется.
              </p>
            )}
          </div>
        ) : null}

        <div className="min-w-0">
          <label
            className="text-sm font-extrabold text-ink"
            htmlFor={`${formId}-comment`}
          >
            Комментарий{" "}
            <span className="font-normal text-muted-foreground">
              (необязательно)
            </span>
          </label>
          <Textarea
            aria-describedby={`${formId}-comment-description`}
            aria-invalid={Boolean(form.formState.errors.comment)}
            className="mt-2 min-h-24 resize-y rounded-xl bg-background px-3"
            id={`${formId}-comment`}
            maxLength={500}
            placeholder="Например, для осеннего видео"
            {...form.register("comment", {
              onChange: () => form.clearErrors("root"),
            })}
          />
          <div
            className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground"
            id={`${formId}-comment-description`}
          >
            <span>{form.formState.errors.comment?.message}</span>
            <span>{form.watch("comment").length}/500</span>
          </div>
        </div>

        <Controller
          control={form.control}
          name="partnerPercent"
          render={({ field }) => (
            <CommissionSplit
              disabled={isPending}
              onChange={(value) => {
                form.clearErrors("partnerPercent");
                form.clearErrors("root");
                field.onChange(value);
              }}
              value={field.value}
            />
          )}
        />

        {form.formState.errors.root?.message ? (
          <p
            className="rounded-xl bg-destructive/8 px-3 py-2 text-sm font-bold text-destructive"
            role="alert"
          >
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {props.mode === "edit" ? (
            <Button
              disabled={isPending}
              onClick={props.onCancel}
              type="button"
              variant="ghost"
            >
              Отмена
            </Button>
          ) : null}
          <Button disabled={isPending} type="submit">
            {isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : props.mode === "create" ? (
              <WandSparkles aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            {props.mode === "create" ? "Создать промокод" : "Сохранить"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
