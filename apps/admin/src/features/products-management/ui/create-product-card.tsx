"use client";

import type { FormEvent } from "react";
import { Plus } from "lucide-react";

import type { ProductCategory } from "@/entities/products";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/shared/ui";

import {
  getBoolean,
  getOptionalString,
  getProductStatus,
  getRequiredInteger,
  getRequiredString,
  type ProductsRefreshCallback,
} from "../lib";
import { useCreateProduct } from "../model";
import {
  LabeledCheckbox,
  LabeledField,
  ProductCategorySelect,
  ProductStatusSelect,
} from "./form-controls";
import { ProductDescriptionEditor } from "./product-description-editor";

type CreateProductCardProps = {
  readonly categories: readonly ProductCategory[];
  readonly onProductsChange: ProductsRefreshCallback;
};

export function CreateProductCard({
  categories,
  onProductsChange,
}: CreateProductCardProps) {
  const { isPending: isCreatingProduct, mutate: createProduct } =
    useCreateProduct({
      onSuccess: onProductsChange,
    });

  function handleCreateProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    createProduct(
      {
        categoryId: getOptionalString(formData.get("categoryId")),
        currency: "RUB",
        description: getOptionalString(formData.get("description")),
        isHit: getBoolean(formData.get("isHit")),
        priceRub: getRequiredInteger(formData.get("priceRub"), "priceRub"),
        slug: getRequiredString(formData.get("slug"), "slug"),
        status: getProductStatus(formData.get("status")),
        title: getRequiredString(formData.get("title"), "title"),
      },
      {
        onSuccess: () => form.reset(),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый товар</CardTitle>
        <CardDescription>
          Базовые данные, цена в рублях и статус публикации
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 lg:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_8rem_11rem_minmax(10rem,1fr)_6rem_auto]"
          onSubmit={handleCreateProductSubmit}
        >
          <LabeledField label="Название">
            <Input name="title" placeholder="Постер Artmate" required />
          </LabeledField>
          <LabeledField label="Slug">
            <Input name="slug" placeholder="artmate-poster" required />
          </LabeledField>
          <LabeledField label="Цена, ₽">
            <Input
              min={0}
              name="priceRub"
              placeholder="1290"
              required
              step={1}
              type="number"
            />
          </LabeledField>
          <LabeledField label="Статус">
            <ProductStatusSelect defaultValue="draft" />
          </LabeledField>
          <LabeledField label="Категория">
            <ProductCategorySelect categories={categories} />
          </LabeledField>
          <LabeledCheckbox label="Хит">
            <input name="isHit" type="checkbox" />
          </LabeledCheckbox>
          <div className="flex items-end">
            <Button className="w-full" disabled={isCreatingProduct} type="submit">
              <Plus data-icon="inline-start" aria-hidden="true" />
              Создать
            </Button>
          </div>
          <LabeledField className="lg:col-span-7" label="Описание">
            <ProductDescriptionEditor name="description" />
          </LabeledField>
        </form>
      </CardContent>
    </Card>
  );
}
