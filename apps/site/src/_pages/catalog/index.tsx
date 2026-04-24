"use client";

import { useProductsData } from "@/entities/products";
import { Catalog } from "@/features/catalog";
import { DataState, Separator } from "@/shared/ui";
import { Hero } from "./ui/hero";

type CatalogPageProps = {
  initialCategoryId?: string;
};

export function CatalogPage({ initialCategoryId }: CatalogPageProps) {
  const { data, isError } = useProductsData();

  return (
    <main className="bg-background">
      <Hero />

      <div className="container">
        <Separator />
      </div>

      {isError ? (
        <section className="container py-10">
          <DataState
            variant="error"
            title="Не удалось загрузить каталог"
            description="Обновите страницу или попробуйте вернуться позже."
          />
        </section>
      ) : !data ? null : data.isEmpty ? (
        <section className="container py-10">
          <DataState
            title="Каталог пока пуст"
            description="Когда появятся товары, они отобразятся в каталоге."
          />
        </section>
      ) : (
        <Catalog
          categories={data.data!.categories}
          products={data.data!.products}
          initialCategoryId={initialCategoryId}
        />
      )}
    </main>
  );
}
