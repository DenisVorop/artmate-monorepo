"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Plus } from "lucide-react";

import type { ProductCategory, ProductTag } from "@/entities/products";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/shared/ui";

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
  ProductTagsField,
} from "./form-controls";
import { ProductDescriptionEditor } from "./product-description-editor";
import { ProductCharacteristicsFields } from "./product-characteristics-fields";

type CreateProductCardProps = {
  readonly categories: readonly ProductCategory[];
  readonly onProductsChange: ProductsRefreshCallback;
  readonly tags: readonly ProductTag[];
};

export function CreateProductCard({
  categories,
  onProductsChange,
  tags,
}: CreateProductCardProps) {
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<ProductFormValues>({
    defaultValues: createProductDefaultValues,
    resolver: zodResolver(productFormSchema),
  });
  const { isPending: isCreatingProduct, mutate: createProduct } =
    useCreateProduct({
      onSuccess: onProductsChange,
    });
  const submitForm = handleSubmit((values) => {
    clearErrors("root");
    createProduct(getCreateProductInput(values), {
      onSuccess: () => reset(),
      onError: () =>
        setError("root.server", {
          message:
            "Не удалось создать товар. Введённые данные остались в форме — попробуйте ещё раз.",
        }),
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
          aria-busy={isCreatingProduct}
          className="grid gap-3"
          noValidate
          onSubmit={submitForm}
        >
          <fieldset className="grid min-w-0 gap-3" disabled={isCreatingProduct}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_8rem_8rem_11rem_minmax(10rem,1fr)]">
              <LabeledField label="Название" error={errors.title?.message}>
                <Input
                  aria-invalid={Boolean(errors.title)}
                  placeholder="Постер Artmate"
                  required
                  {...register("title")}
                />
              </LabeledField>
              <LabeledField label="Slug" error={errors.slug?.message}>
                <Input
                  aria-invalid={Boolean(errors.slug)}
                  placeholder="artmate-poster"
                  required
                  {...register("slug")}
                />
              </LabeledField>
              <LabeledField
                label="Обычная цена, ₽"
                error={errors.priceRub?.message}
              >
                <Input
                  aria-invalid={Boolean(errors.priceRub)}
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
              <div className="grid content-start gap-1.5">
                <LabeledField
                  label="Цена со скидкой, ₽"
                  error={errors.salePriceRub?.message}
                >
                  <Input
                    aria-invalid={Boolean(errors.salePriceRub)}
                    min={1}
                    placeholder="Без скидки"
                    step={1}
                    type="number"
                    {...register("salePriceRub", {
                      setValueAs: (value: string) =>
                        value === "" ? null : Number(value),
                    })}
                  />
                </LabeledField>
                <p className="text-xs text-muted-foreground">
                  Оставьте пустым, чтобы продавать без скидки.
                </p>
              </div>
              <LabeledField label="Статус" error={errors.status?.message}>
                <ProductStatusSelect
                  defaultValue="draft"
                  selectProps={register("status")}
                />
              </LabeledField>
              <LabeledField
                label="Категория"
                error={errors.categoryId?.message}
              >
                <ProductCategorySelect
                  categories={categories}
                  selectProps={register("categoryId")}
                />
              </LabeledField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[6rem_8rem_minmax(12rem,1fr)]">
              <LabeledCheckbox label="Хит">
                <input type="checkbox" {...register("isHit")} />
              </LabeledCheckbox>
              <LabeledCheckbox label="Нет в наличии">
                <input type="checkbox" {...register("isOutOfStock")} />
              </LabeledCheckbox>
              <LabeledCheckbox label="Доступна доставка Ozon">
                <input
                  type="checkbox"
                  {...register("isOzonDeliveryAvailable")}
                />
              </LabeledCheckbox>
            </div>
            <LabeledField label="Теги">
              <ProductTagsField inputProps={register("tagIds")} tags={tags} />
            </LabeledField>
            <LabeledField label="Описание">
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <ProductDescriptionEditor
                    disabled={isCreatingProduct}
                    name={field.name}
                    onValueChange={field.onChange}
                    value={field.value}
                  />
                )}
              />
            </LabeledField>
            <ProductCharacteristicsFields
              control={control}
              disabled={isCreatingProduct}
              errors={errors}
              register={register}
            />
            <Button
              className="w-full sm:w-auto sm:justify-self-start"
              disabled={isCreatingProduct}
              type="submit"
            >
              <Plus data-icon="inline-start" aria-hidden="true" />
              Создать
            </Button>
          </fieldset>
          {errors.root?.server && (
            <p className="text-sm text-destructive" role="alert">
              {errors.root.server.message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
