"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Plus } from "lucide-react";

import type { ProductCategory } from "@/entities/products";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/shared/ui";

import {
  createProductDefaultValues,
  getCreateProductInput,
  productFormSchema,
  type ProductFormValues,
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
  const { control, handleSubmit, register, reset } = useForm<ProductFormValues>({
    defaultValues: createProductDefaultValues,
    resolver: zodResolver(productFormSchema),
  });
  const { isPending: isCreatingProduct, mutate: createProduct } =
    useCreateProduct({
      onSuccess: onProductsChange,
    });
  const submitForm = handleSubmit((values) => {
    createProduct(getCreateProductInput(values), {
      onSuccess: () => reset(),
    });
  });

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
          onSubmit={submitForm}
        >
          <LabeledField label="Название">
            <Input
              placeholder="Постер Artmate"
              required
              {...register("title")}
            />
          </LabeledField>
          <LabeledField label="Slug">
            <Input
              placeholder="artmate-poster"
              required
              {...register("slug")}
            />
          </LabeledField>
          <LabeledField label="Цена, ₽">
            <Input
              min={0}
              placeholder="1290"
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
              defaultValue="draft"
              selectProps={register("status")}
            />
          </LabeledField>
          <LabeledField label="Категория">
            <ProductCategorySelect
              categories={categories}
              selectProps={register("categoryId")}
            />
          </LabeledField>
          <LabeledCheckbox label="Хит">
            <input type="checkbox" {...register("isHit")} />
          </LabeledCheckbox>
          <div className="flex items-end">
            <Button className="w-full" disabled={isCreatingProduct} type="submit">
              <Plus data-icon="inline-start" aria-hidden="true" />
              Создать
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
      </CardContent>
    </Card>
  );
}
