"use client";

import { ProductCard } from "@/entities/products";
import { useCatalog } from "../lib/catalog-provider";
import { EmptyState } from "./empty-state";
import { Summary } from "./summary";

export function List() {
  const { filteredProducts, renderProductCard } = useCatalog();

  return (
    <section className="container py-6">
      <Summary />

      {filteredProducts.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product, index) => (
            <li key={product.id} className="h-full">
              {renderProductCard ? (
                renderProductCard(product, index)
              ) : (
                <ProductCard product={product} eagerImage={index === 0} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-16">
          <EmptyState />
        </div>
      )}
    </section>
  );
}
