"use client";

import { useProductsData } from "@/entities/products";
import { Catalog } from "@/features/catalog";
import { Separator } from "@/shared";
import { Hero } from "./ui/hero";

type CatalogPageProps = {
  initialCategoryId?: string;
};

export function CatalogPage({ initialCategoryId }: CatalogPageProps) {
  const { categories, products } = useProductsData();

  return (
    <main className="bg-background">
      <Hero />

      <div className="container">
        <Separator />
      </div>

      <Catalog categories={categories} products={products} initialCategoryId={initialCategoryId} />
    </main>
  );
}
