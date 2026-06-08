"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  Controller,
  useFieldArray,
  type UseFormRegister,
  type UseFormReturn,
} from "react-hook-form";

import {
  getCatalogLandingProductSourceLabel,
  getCatalogLandingStatusLabel,
} from "@/entities/catalog-landings";
import { getProductTagGroupLabel, type Product, type ProductTag } from "@/entities/products";
import {
  catalogLandingProductSources,
  catalogLandingStatuses,
} from "@/shared/actions/catalog-landings";
import {
  Button,
  Input,
  RichTextEditor,
  Separator,
  Textarea,
} from "@/shared/ui";

import type { CatalogLandingFormValues } from "../lib";

type CatalogLandingFormProps = {
  readonly form: UseFormReturn<CatalogLandingFormValues>;
  readonly formId: string;
  readonly onSubmit: () => void;
  readonly products: readonly Product[];
  readonly submitLabel: string;
  readonly submitPending: boolean;
  readonly tags: readonly ProductTag[];
};

export function CatalogLandingForm({
  form,
  formId,
  onSubmit,
  products,
  submitLabel,
  submitPending,
  tags,
}: CatalogLandingFormProps) {
  const { control, register } = form;
  const faqFields = useFieldArray({
    control,
    name: "faqItems",
  });

  return (
    <form className="grid gap-5" id={formId} onSubmit={onSubmit}>
      <div className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_8rem]">
        <LabeledField label="Slug">
          <Input required {...register("slug")} />
        </LabeledField>
        <LabeledField label="H1">
          <Input required {...register("h1")} />
        </LabeledField>
        <LabeledField label="Статус">
          <select className={fieldClassName} {...register("status")}>
            {catalogLandingStatuses.map((status) => (
              <option key={status} value={status}>
                {getCatalogLandingStatusLabel(status)}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField label="Минимум товаров">
          <Input
            min={0}
            step={1}
            type="number"
            {...register("minProducts", { valueAsNumber: true })}
          />
        </LabeledField>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)]">
        <LabeledField label="Meta title">
          <Input required {...register("metaTitle")} />
        </LabeledField>
        <LabeledField label="Meta description">
          <Textarea required {...register("metaDescription")} />
        </LabeledField>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("isIndexable")} />
        Индексировать страницу и добавлять в sitemap
      </label>

      <div className="grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <LabeledField label="Источник товаров">
          <select className={fieldClassName} {...register("productSource")}>
            {catalogLandingProductSources.map((source) => (
              <option key={source} value={source}>
                {getCatalogLandingProductSourceLabel(source)}
              </option>
            ))}
          </select>
        </LabeledField>
      </div>

      <Separator />

      <div className="grid gap-3 xl:grid-cols-3">
        <CheckboxGroup
          emptyText="Сначала добавьте теги."
          inputProps={register("requiredTagIds")}
          items={tags}
          label="Обязательные теги"
          renderLabel={(tag) => `${tag.title} · ${getProductTagGroupLabel(tag.group)}`}
        />
        <CheckboxGroup
          emptyText="Сначала добавьте теги."
          inputProps={register("optionalTagIds")}
          items={tags}
          label="Опциональные теги"
          renderLabel={(tag) => `${tag.title} · ${getProductTagGroupLabel(tag.group)}`}
        />
        <CheckboxGroup
          emptyText="Сначала добавьте теги."
          inputProps={register("excludedTagIds")}
          items={tags}
          label="Исключить теги"
          renderLabel={(tag) => `${tag.title} · ${getProductTagGroupLabel(tag.group)}`}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <CheckboxGroup
          emptyText="Сначала добавьте товары."
          inputProps={register("includedProductIds")}
          items={products}
          label="Добавить товары вручную"
          renderLabel={(product) => product.title}
        />
        <CheckboxGroup
          emptyText="Сначала добавьте товары."
          inputProps={register("excludedProductIds")}
          items={products}
          label="Исключить товары"
          renderLabel={(product) => product.title}
        />
      </div>

      <Separator />

      <div className="grid gap-3">
        <LabeledField label="Intro над товарами">
          <Controller
            control={control}
            name="introHtml"
            render={({ field }) => (
              <RichTextEditor
                name={field.name}
                onValueChange={field.onChange}
                placeholder="Короткий текст над товарами"
                value={field.value}
              />
            )}
          />
        </LabeledField>
        <LabeledField label="SEO title нижнего блока">
          <Input {...register("seoTitle")} />
        </LabeledField>
        <LabeledField label="SEO текст под товарами">
          <Controller
            control={control}
            name="seoHtml"
            render={({ field }) => (
              <RichTextEditor
                name={field.name}
                onValueChange={field.onChange}
                placeholder="Полезный текст под витриной"
                value={field.value}
              />
            )}
          />
        </LabeledField>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">FAQ</p>
          <Button
            onClick={() => faqFields.append({ answerHtml: "", question: "" })}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            Добавить вопрос
          </Button>
        </div>
        {faqFields.fields.map((field, index) => (
          <div key={field.id} className="grid gap-2 rounded-lg border border-input p-3">
            <div className="flex items-start gap-2">
              <LabeledField className="flex-1" label="Вопрос">
                <Input {...register(`faqItems.${index}.question`)} />
              </LabeledField>
              <Button
                aria-label="Удалить вопрос"
                onClick={() => faqFields.remove(index)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <LabeledField label="Ответ">
              <Controller
                control={control}
                name={`faqItems.${index}.answerHtml`}
                render={({ field: answerField }) => (
                  <RichTextEditor
                    name={answerField.name}
                    onValueChange={answerField.onChange}
                    placeholder="Ответ на вопрос"
                    value={answerField.value}
                  />
                )}
              />
            </LabeledField>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button disabled={submitPending} type="submit">
          <Save data-icon="inline-start" aria-hidden="true" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

const fieldClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

function LabeledField({
  children,
  className,
  label,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
}) {
  return (
    <label className={`grid gap-1.5 ${className ?? ""}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CheckboxGroup<T extends { id: string }>({
  emptyText,
  inputProps,
  items,
  label,
  renderLabel,
}: {
  readonly emptyText: string;
  readonly inputProps: ReturnType<UseFormRegister<CatalogLandingFormValues>>;
  readonly items: readonly T[];
  readonly label: string;
  readonly renderLabel: (_item: T) => string;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-input p-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="grid gap-2">
            {items.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" value={item.id} {...inputProps} />
                <span className="min-w-0 truncate">{renderLabel(item)}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
