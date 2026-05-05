import type { ComponentProps, ReactNode } from "react";
import { Info } from "lucide-react";

import type { Product, ProductCategory } from "@/entities/products";
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";

import type { SeoSourceKind } from "../lib";

const sourceKindOptions: readonly { label: string; value: SeoSourceKind }[] = [
  { label: "Страница", value: "page" },
  { label: "Товар", value: "product" },
  { label: "Категория", value: "product_category" },
  { label: "Custom", value: "custom" },
];

export const fieldClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

export const textareaClassName =
  "min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

export function LabeledField({
  children,
  className,
  description,
  label,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly description?: string;
  readonly label: string;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <FieldLabel description={description} label={label} />
      {children}
    </div>
  );
}

export function LabeledCheckbox({
  children,
  description,
  label,
}: {
  readonly children: ReactNode;
  readonly description?: string;
  readonly label: string;
}) {
  return (
    <div className="grid min-w-0 content-end gap-1.5">
      <FieldLabel description={description} label={label} />
      <span className="flex h-8 items-center rounded-lg border border-input px-2.5">
        {children}
      </span>
    </div>
  );
}

function FieldLabel({
  description,
  label,
}: {
  readonly description?: string;
  readonly label: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {description ? <FieldInfo description={description} label={label} /> : null}
    </span>
  );
}

function FieldInfo({
  description,
  label,
}: {
  readonly description: string;
  readonly label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={`Описание поля ${label}`}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          type="button"
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}

export function SourceKindSelect({
  defaultValue,
  selectProps,
}: {
  readonly defaultValue: SeoSourceKind;
  readonly selectProps?: ComponentProps<"select">;
}) {
  return (
    <select className={fieldClassName} defaultValue={defaultValue} {...selectProps}>
      {sourceKindOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ProductSelect({
  defaultValue,
  products,
  selectProps,
}: {
  readonly defaultValue?: string;
  readonly products: readonly Product[];
  readonly selectProps?: ComponentProps<"select">;
}) {
  return (
    <select className={fieldClassName} defaultValue={defaultValue ?? ""} {...selectProps}>
      <option value="">Не выбран</option>
      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.title}
        </option>
      ))}
    </select>
  );
}

export function CategorySelect({
  categories,
  defaultValue,
  selectProps,
}: {
  readonly categories: readonly ProductCategory[];
  readonly defaultValue?: string;
  readonly selectProps?: ComponentProps<"select">;
}) {
  return (
    <select className={fieldClassName} defaultValue={defaultValue ?? ""} {...selectProps}>
      <option value="">Не выбрана</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.title}
        </option>
      ))}
    </select>
  );
}
