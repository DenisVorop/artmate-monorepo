"use client";

import { Save } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import type { Product } from "@/entities/products";
import { Button, Input, Textarea } from "@/shared/ui";

import type { CollectionFormValues } from "../lib";

type CollectionFormProps = {
  readonly disableProduct?: boolean;
  readonly form: UseFormReturn<CollectionFormValues>;
  readonly formId: string;
  readonly onSubmit: () => void;
  readonly products: readonly Product[];
  readonly submitDisabled?: boolean;
  readonly submitLabel: string;
  readonly submitPending: boolean;
};

const fieldClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function CollectionForm({
  disableProduct = false,
  form,
  formId,
  onSubmit,
  products,
  submitDisabled = false,
  submitLabel,
  submitPending,
}: CollectionFormProps) {
  const { formState, register } = form;
  const disabled = submitDisabled || submitPending;

  return (
    <form className="grid gap-5" id={formId} onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field error={formState.errors.productId?.message} label="Товар">
          {disableProduct ? (
            <>
              <input type="hidden" {...register("productId")} />
              <Input
                readOnly
                value={
                  products.find((product) => product.id === form.getValues("productId"))
                    ?.title ?? "Товар не найден"
                }
              />
            </>
          ) : (
            <select
              className={fieldClassName}
              disabled={disabled}
              {...register("productId")}
            >
              <option value="">Выберите товар</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title} ({product.slug})
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field error={formState.errors.slug?.message} label="Slug">
          <Input disabled={disabled} placeholder="animals" {...register("slug")} />
        </Field>
      </div>
      <Field error={formState.errors.title?.message} label="Название">
        <Input disabled={disabled} {...register("title")} />
      </Field>
      <Field error={formState.errors.description?.message} label="Описание">
        <Textarea disabled={disabled} rows={5} {...register("description")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={formState.errors.position?.message} label="Позиция">
          <Input
            disabled={disabled}
            min={0}
            step={1}
            type="number"
            {...register("position", { valueAsNumber: true })}
          />
        </Field>
        <Field
          error={formState.errors.expectedColoringCount?.message}
          label="План раскрасок"
        >
          <Input
            disabled={disabled}
            max={99}
            min={1}
            step={1}
            type="number"
            {...register("expectedColoringCount", { valueAsNumber: true })}
          />
        </Field>
      </div>
      <div>
        <Button disabled={disabled} type="submit">
          <Save data-icon="inline-start" aria-hidden="true" />
          {submitPending ? "Сохраняем..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

type FieldProps = {
  readonly children: React.ReactNode;
  readonly error?: string;
  readonly label: string;
};

export function Field({ children, error, label }: FieldProps) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error && <span className="text-xs font-normal text-destructive">{error}</span>}
    </label>
  );
}
