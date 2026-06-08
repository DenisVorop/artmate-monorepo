"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { useProducts, useTags } from "@/entities/products";
import { routes } from "@/shared/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import {
  catalogLandingFormSchema,
  createCatalogLandingDefaultValues,
  getCreateCatalogLandingInput,
  type CatalogLandingFormValues,
} from "../lib";
import { useCreateCatalogLanding } from "../model";
import { CatalogLandingForm } from "./catalog-landing-form";

export function CreateCatalogLanding() {
  const router = useRouter();
  const { isError: isProductsError, isPending: isProductsPending, products } = useProducts();
  const { isError: isTagsError, isPending: isTagsPending, tags } = useTags();
  const form = useForm<CatalogLandingFormValues>({
    defaultValues: createCatalogLandingDefaultValues,
    resolver: zodResolver(catalogLandingFormSchema),
  });
  const { isPending: isCreatingLanding, mutate: createLanding } = useCreateCatalogLanding();
  const submitForm = form.handleSubmit((values) => {
    createLanding(getCreateCatalogLandingInput(values), {
      onSuccess: (landing) => router.push(routes.catalogLanding(landing.id)),
    });
  });

  if (isProductsError || isTagsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить данные</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Перезагрузите страницу и повторите действие.
        </CardContent>
      </Card>
    );
  }

  if (isProductsPending || isTagsPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка формы</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем товары и теги.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новая подборка</CardTitle>
      </CardHeader>
      <CardContent>
        <CatalogLandingForm
          form={form}
          formId="create-catalog-landing"
          onSubmit={submitForm}
          products={products}
          submitLabel="Создать"
          submitPending={isCreatingLanding}
          tags={tags}
        />
      </CardContent>
    </Card>
  );
}
