"use client";

import { AnimatePresence, motion } from "motion/react";
import { ProductCard } from "@/entities/products";
import { useCatalog } from "../lib/catalog-provider";
import { EmptyState } from "./empty-state";
import { Summary } from "./summary";

export function List() {
  const { filteredProducts, onAddToCart } = useCatalog();

  return (
    <section className="container py-6">
      <Summary />

      <AnimatePresence mode="wait">
        {filteredProducts.length > 0 ? (
          <ul key="grid" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product, index) => (
              <motion.li key={product.id} layout transition={{ duration: 0.18 }} className="h-full">
                <ProductCard
                  product={product}
                  eagerImage={index === 0}
                  onAddToCart={onAddToCart}
                />
              </motion.li>
            ))}
          </ul>
        ) : (
          <div key="empty" className="py-16">
            <EmptyState />
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
