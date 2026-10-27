"use client";

import type { Product } from "@/entities/products";
import { CartProductCard } from "@/features/cart";
import { ProductCashback } from "@/features/product-cashback";

type CatalogLandingProductsProps = {
  readonly products: readonly Product[];
};

export function CatalogLandingProducts({ products }: CatalogLandingProductsProps) {
  return (
    <section className="container py-10" aria-label="Товары подборки">
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => (
          <CartProductCard
            key={product.id}
            product={product}
            cashback={<ProductCashback product={product} />}
            eagerImage={index === 0}
            list="catalog_landing"
            position={index + 1}
          />
        ))}
      </div>
    </section>
  );
}
