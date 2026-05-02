"use client";

import { Controller, useForm } from "react-hook-form";
import { Save } from "lucide-react";

import type { Product, ProductCategory } from "@/entities/products";
import { Button, Input } from "@/shared/ui";

import {
  getProductDefaultValues,
  getUpdateProductInput,
  type ProductFormValues,
  type ProductsRefreshCallback,
} from "../lib";
import { useUpdateProduct } from "../model";
import {
  LabeledCheckbox,
  LabeledField,
  ProductCategorySelect,
  ProductStatusSelect,
} from "./form-controls";
import { ProductDescriptionEditor } from "./product-description-editor";

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
  const { control, handleSubmit, register } = useForm<ProductFormValues>({
    defaultValues: getProductDefaultValues(product),
  });
  const { isPending: isUpdatingProduct, mutate: updateProduct } =
    useUpdateProduct({
      onSuccess: onProductsChange,
    });
  const submitForm = handleSubmit((values) => {
    updateProduct({
      input: getUpdateProductInput(values),
      productId: product.id,
    });
  });

  return (
    <form
      className="grid gap-3 lg:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_8rem_11rem_minmax(10rem,1fr)_6rem_auto]"
      onSubmit={submitForm}
    >
      <LabeledField label="Название">
        <Input required {...register("title", { required: true })} />
      </LabeledField>
      <LabeledField label="Slug">
        <Input required {...register("slug", { required: true })} />
      </LabeledField>
      <LabeledField label="Цена, ₽">
        <Input
          min={0}
          required
          step={1}
          type="number"
          {...register("priceRub", {
            min: 0,
            required: true,
            valueAsNumber: true,
          })}
        />
      </LabeledField>
      <LabeledField label="Статус">
        <ProductStatusSelect
          defaultValue={product.status}
          selectProps={register("status")}
        />
      </LabeledField>
      <LabeledField label="Категория">
        <ProductCategorySelect
          categories={categories}
          defaultValue={product.categoryId}
          selectProps={register("categoryId")}
        />
      </LabeledField>
      <LabeledCheckbox label="Хит">
        <input type="checkbox" {...register("isHit")} />
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
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <ProductDescriptionEditor
              name={field.name}
              onValueChange={field.onChange}
              value={field.value}
            />
          )}
        />
      </LabeledField>
    </form>
  );
}
