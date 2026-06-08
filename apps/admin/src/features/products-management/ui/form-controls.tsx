import type { ComponentProps, ReactNode } from "react";

import {
  getProductStatusLabel,
  type ProductCategory,
  type ProductStatus,
  type ProductTag,
} from "@/entities/products";

const productStatusOptions: readonly ProductStatus[] = [
  "draft",
  "published",
  "archived",
];

export const fieldClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

export function LabeledField({
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

export function LabeledCheckbox({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return (
    <label className="grid content-end gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex h-8 items-center rounded-lg border border-input px-2.5">
        {children}
      </span>
    </label>
  );
}

export function ProductStatusSelect({
  defaultValue,
  selectProps,
}: {
  readonly defaultValue: ProductStatus;
  readonly selectProps?: ComponentProps<"select">;
}) {
  return (
    <select
      className={fieldClassName}
      defaultValue={defaultValue}
      {...selectProps}
    >
      {productStatusOptions.map((status) => (
        <option key={status} value={status}>
          {getProductStatusLabel(status)}
        </option>
      ))}
    </select>
  );
}

export function ProductCategorySelect({
  categories,
  defaultValue,
  selectProps,
}: {
  readonly categories: readonly ProductCategory[];
  readonly defaultValue?: string;
  readonly selectProps?: ComponentProps<"select">;
}) {
  return (
    <select
      className={fieldClassName}
      defaultValue={defaultValue ?? ""}
      {...selectProps}
    >
      <option value="">Без категории</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.title}
        </option>
      ))}
    </select>
  );
}

export function ProductTagsField({
  inputProps,
  tags,
}: {
  readonly inputProps: ComponentProps<"input">;
  readonly tags: readonly ProductTag[];
}) {
  if (tags.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-input px-3 py-2 text-sm text-muted-foreground">
        Сначала добавьте теги товаров.
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border border-input p-3 sm:grid-cols-2 lg:grid-cols-4">
      {tags.map((tag) => (
        <label key={tag.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" value={tag.id} {...inputProps} />
          <span className="min-w-0 truncate">{tag.title}</span>
        </label>
      ))}
    </div>
  );
}
