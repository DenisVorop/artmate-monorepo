"use client";

import type { Product } from "@/entities/products";
import { CartProductCard } from "@/features/cart";
import { ProductCashback } from "@/features/product-cashback";

type CatalogLandingProductsProps = {
  readonly products: readonly Product[];
};

// This grid uses the full container, without the catalog sidebar.
const imageSizes =
  "(min-width: 96rem) 22.75rem, (min-width: 80rem) 18.75rem, (min-width: 64rem) 20rem, (min-width: 48rem) 22.5rem, (min-width: 40rem) 18.5rem, calc(50vw - 1.375rem)";

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
            imageSizes={imageSizes}
            list="catalog_landing"
            position={index + 1}
          />
        ))}
      </div>
    </section>
  );
}
