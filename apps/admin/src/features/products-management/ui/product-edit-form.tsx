"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Save } from "lucide-react";

import type { Product, ProductCategory, ProductTag } from "@/entities/products";
import { Button, Input } from "@/shared/ui";

import {
  getProductDefaultValues,
  getUpdateProductInput,
  productFormSchema,
  type ProductFormValues,
  type ProductsRefreshCallback,
} from "../lib";
import { useUpdateProduct } from "../model";
import {
  LabeledCheckbox,
  LabeledField,
  ProductCategorySelect,
  ProductStatusSelect,
  ProductTagsField,
} from "./form-controls";
import { ProductDescriptionEditor } from "./product-description-editor";

type ProductEditFormProps = {
  readonly categories: readonly ProductCategory[];
  readonly onProductsChange: ProductsRefreshCallback;
  readonly product: Product;
  readonly tags: readonly ProductTag[];
};

export function ProductEditForm({
  categories,
  onProductsChange,
  product,
  tags,
}: ProductEditFormProps) {
  const { control, handleSubmit, register } = useForm<ProductFormValues>({
    defaultValues: getProductDefaultValues(product),
    resolver: zodResolver(productFormSchema),
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
      className="grid gap-3 lg:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_8rem_11rem_minmax(10rem,1fr)_6rem_8rem_auto]"
      onSubmit={submitForm}
    >
      <LabeledField label="Название">
        <Input required {...register("title")} />
      </LabeledField>
      <LabeledField label="Slug">
        <Input required {...register("slug")} />
      </LabeledField>
      <LabeledField label="Цена, ₽">
        <Input
          min={0}
          required
          step={1}
          type="number"
          {...register("priceRub", {
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
      <LabeledCheckbox label="Нет в наличии">
        <input type="checkbox" {...register("isOutOfStock")} />
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
      <LabeledField className="lg:col-span-8" label="Теги">
        <ProductTagsField inputProps={register("tagIds")} tags={tags} />
      </LabeledField>
      <LabeledField className="lg:col-span-8" label="Описание">
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
