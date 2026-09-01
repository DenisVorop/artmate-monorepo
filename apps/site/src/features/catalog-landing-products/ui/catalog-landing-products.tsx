"use client";

import type { Product } from "@/entities/products";
import { CartProductCard } from "@/features/cart";

type CatalogLandingProductsProps = {
  readonly products: readonly Product[];
};

export function CatalogLandingProducts({ products }: CatalogLandingProductsProps) {
  return (
    <section className="container py-10" aria-label="Товары подборки">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => (
          <CartProductCard
            key={product.id}
            product={product}
            eagerImage={index === 0}
            list="catalog_landing"
            position={index + 1}
          />
        ))}
      </div>
    </section>
  );
}
