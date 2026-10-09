"use client";

import { ProductCard } from "@/entities/products";
import { useCatalog } from "../lib/catalog-provider";
import { EmptyState } from "./empty-state";
import { Summary } from "./summary";

export function List() {
  const { filteredProducts, renderProductCard, suggestedProducts } = useCatalog();

  return (
    <section aria-label="Товары">
      <Summary />

      {filteredProducts.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredProducts.map((product, index) => (
            <li key={product.id} className="h-full">
              {renderProductCard ? (
                renderProductCard(product, index, "catalog")
              ) : (
                <ProductCard
                  product={product}
                  eagerImage={index === 0}
                  mediaAspectRatio={3 / 4}
                  variant="plain"
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-10 py-12">
          <EmptyState />
          {suggestedProducts.length > 0 && (
            <section className="space-y-4" aria-labelledby="catalog-search-suggestions-title">
              <div className="space-y-1">
                <h2
                  id="catalog-search-suggestions-title"
                  className="font-display text-2xl font-bold text-stone-900"
                >
                  Возможно вы искали
                </h2>
                <p className="text-sm text-muted-foreground">
                  Похожие товары из каталога по вашему запросу.
                </p>
              </div>

              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {suggestedProducts.map((product, index) => (
                  <li key={product.id} className="h-full">
                    {renderProductCard ? (
                      renderProductCard(product, index, "catalog_search_suggestions")
                    ) : (
                      <ProductCard product={product} mediaAspectRatio={3 / 4} variant="plain" />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
