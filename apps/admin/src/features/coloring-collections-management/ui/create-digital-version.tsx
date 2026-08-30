"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { useProducts } from "@/entities/products";
import { useColoringCollections } from "@/entities/coloring-collections";
import { routes } from "@/shared/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

import {
  collectionFormSchema,
  createCollectionDefaultValues,
  getCreateCollectionInput,
  type CollectionFormValues,
} from "../lib";
import { useCreateCollection } from "../model";
import { CollectionForm } from "./collection-form";
import { StateCard } from "./digital-versions-management";

export function CreateDigitalVersion() {
  const router = useRouter();
  const {
    collections,
    isError: isCollectionsError,
    isPending: isCollectionsPending,
  } = useColoringCollections();
  const { isError, isPending, products } = useProducts();
  const form = useForm<CollectionFormValues>({
    defaultValues: createCollectionDefaultValues,
    resolver: zodResolver(collectionFormSchema),
  });
  const { isPending: isCreating, mutate: createCollection } = useCreateCollection({
    onSuccess: (collection) => router.push(routes.digitalVersion(collection.id)),
  });

  if (isError || isCollectionsError) {
    return <StateCard title="Не удалось открыть форму" text="Не удалось загрузить список товаров." />;
  }

  if (isPending || isCollectionsPending) {
    return <StateCard title="Загрузка формы" text="Получаем товары для цифровой версии." />;
  }

  const occupiedProductIds = new Set(
    collections.map((collection) => collection.productId),
  );
  const availableProducts = products.filter(
    (product) => !occupiedProductIds.has(product.id),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новая цифровая версия</CardTitle>
        <CardDescription>Коллекция будет создана в статусе «Черновик».</CardDescription>
      </CardHeader>
      <CardContent>
        <CollectionForm
          form={form}
          formId="create-digital-version"
          onSubmit={form.handleSubmit((values) => {
            if (!isCreating) createCollection(getCreateCollectionInput(values));
          })}
          products={availableProducts}
          submitLabel="Создать цифровую версию"
          submitPending={isCreating}
        />
      </CardContent>
    </Card>
  );
}
