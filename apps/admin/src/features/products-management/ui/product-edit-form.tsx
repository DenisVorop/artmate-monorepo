"use client";

import type { FormEvent } from "react";
import { Save } from "lucide-react";

import type { Product, ProductCategory } from "@/entities/products";
import { Button, Input } from "@/shared/ui";

import {
  getBoolean,
  getNullableString,
  getProductStatus,
  getRequiredInteger,
  getRequiredString,
  getString,
  type ProductsRefreshCallback,
} from "../lib";
import { useUpdateProduct } from "../model";
import {
  LabeledCheckbox,
  LabeledField,
  ProductCategorySelect,
  ProductStatusSelect,
  textareaClassName,
} from "./form-controls";

type ProductEditFormProps = {
  readonly categories: readonly ProductCategory[];
  readonly onProductsChange: ProductsRefreshCallback;
  readonly product: Product;
};

export function ProductEditForm({
  categories,
  onProductsChange,
  product,
}: ProductEditFormProps) {
  const { isPending: isUpdatingProduct, mutate: updateProduct } =
    useUpdateProduct({
      onSuccess: onProductsChange,
    });

  function handleUpdateProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    updateProduct(
      {
        input: {
          categoryId: getNullableString(formData.get("categoryId")),
          currency: "RUB",
          description: getString(formData.get("description")),
          isHit: getBoolean(formData.get("isHit")),
          priceRub: getRequiredInteger(formData.get("priceRub"), "priceRub"),
          slug: getRequiredString(formData.get("slug"), "slug"),
          status: getProductStatus(formData.get("status")),
          title: getRequiredString(formData.get("title"), "title"),
        },
        productId: product.id,
      },
    );
  }

  return (
    <form
      className="grid gap-3 lg:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_8rem_11rem_minmax(10rem,1fr)_6rem_auto]"
      onSubmit={handleUpdateProductSubmit}
    >
      <LabeledField label="Название">
        <Input name="title" required defaultValue={product.title} />
      </LabeledField>
      <LabeledField label="Slug">
        <Input name="slug" required defaultValue={product.slug} />
      </LabeledField>
      <LabeledField label="Цена, ₽">
        <Input
          defaultValue={product.priceRub}
          min={0}
          name="priceRub"
          required
          step={1}
          type="number"
        />
      </LabeledField>
      <LabeledField label="Статус">
        <ProductStatusSelect defaultValue={product.status} />
      </LabeledField>
      <LabeledField label="Категория">
        <ProductCategorySelect
          categories={categories}
          defaultValue={product.categoryId}
        />
      </LabeledField>
      <LabeledCheckbox label="Хит">
        <input defaultChecked={product.isHit} name="isHit" type="checkbox" />
      </LabeledCheckbox>
      <div className="flex items-end">
        <Button
          className="w-full"
          disabled={isUpdatingProduct}
          type="submit"
          variant="outline"
        >
          <Save data-icon="inline-start" aria-hidden="true" />
          Сохранить
        </Button>
      </div>
      <LabeledField className="lg:col-span-7" label="Описание">
        <textarea
          className={textareaClassName}
          defaultValue={product.description}
          name="description"
        />
      </LabeledField>
    </form>
  );
}
