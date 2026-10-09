import { Catalog } from "@/features/catalog";
import { CatalogLandingsLinks } from "@/features/catalog-landings-links";
import type { ProductCategory } from "@/entities/products";
import { Hero } from "./ui/hero";
import { CollectionDivider } from "./ui/collection-divider";

type CatalogPageProps = {
  category?: ProductCategory;
  initialCategoryId?: string;
};

export function CatalogPage({ category, initialCategoryId }: CatalogPageProps) {
  return (
    <main className="bg-background">
      <Hero category={category} />

      <Catalog initialCategoryId={initialCategoryId} />

      <CatalogLandingsLinks decoration={<CollectionDivider />} />
    </main>
  );
}
