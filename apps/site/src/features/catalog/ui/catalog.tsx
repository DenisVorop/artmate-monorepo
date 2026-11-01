"use client";

import { useProductsData } from "@/entities/products";
import { CartProductCard } from "@/features/cart";
import { ProductCashback } from "@/features/product-cashback";
import { DataState } from "@/shared/ui";

import { BaseCatalog } from "./base-catalog";
import type { CatalogCategoryValue } from "../lib/catalog-state";
import { imageSizes } from "../lib/image-sizes";

type CatalogProps = {
  initialCategoryId?: string;
  section?: CatalogCategoryValue;
};

export function Catalog({ initialCategoryId, section }: CatalogProps) {
  const { data, isError } = useProductsData();

  if (isError) {
    return (
      <section className="container py-10">
        <DataState
          variant="error"
          title="Не удалось загрузить каталог"
          description="Обновите страницу или попробуйте вернуться позже."
        />
      </section>
    );
  }

  if (!data) {
    return null;
  }

  if (data.products.length === 0) {
    return (
      <section className="container py-10">
        <DataState
          title="Каталог пока пуст"
          description="Когда появятся товары, они отобразятся в каталоге."
        />
      </section>
    );
  }

  return (
    <BaseCatalog
      categories={data.categories}
      products={data.products}
      initialCategoryId={initialCategoryId}
      section={section}
      renderProductCard={(product, index, placement) => (
        <CartProductCard
          product={product}
          cashback={<ProductCashback product={product} />}
          mediaAspectRatio={3 / 4}
          variant="plain"
          imageSizes={imageSizes}
          eagerImage={index === 0}
          list={placement}
          position={index + 1}
        />
      )}
    />
  );
}
