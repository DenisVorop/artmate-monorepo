"use client";

import { useProductsData } from "@/entities/products";
import { CartProductCard, useAddProductToCart } from "@/features/cart";
import { Catalog } from "@/features/catalog";
import { DataState, Separator } from "@/shared/ui";
import { Hero } from "./ui/hero";

type CatalogPageProps = {
  initialCategoryId?: string;
};

export function CatalogPage({ initialCategoryId }: CatalogPageProps) {
  const { data, isError } = useProductsData();
  const addProductToCart = useAddProductToCart();

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
      ) : !data ? null : data.products.length === 0 ? (
        <section className="container py-10">
          <DataState
            title="Каталог пока пуст"
            description="Когда появятся товары, они отобразятся в каталоге."
          />
        </section>
      ) : (
        <Catalog
          categories={data.categories}
          products={data.products}
          initialCategoryId={initialCategoryId}
          renderProductCard={(product, index) => (
            <CartProductCard
              product={product}
              eagerImage={index === 0}
              onAddToCart={addProductToCart}
            />
          )}
        />
      )}
    </main>
  );
}
