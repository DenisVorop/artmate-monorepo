import { Catalog } from "@/features/catalog";
import { CatalogLandingsLinks } from "@/features/catalog-landings-links";
import type { ProductCategory } from "@/entities/products";
import { Separator } from "@/shared/ui";
import { Hero } from "./ui/hero";

type CatalogPageProps = {
  category?: ProductCategory;
  initialCategoryId?: string;
};

export function CatalogPage({ category, initialCategoryId }: CatalogPageProps) {
  return (
    <main className="bg-background">
      <Hero category={category} />

      <div className="container">
        <Separator />
      </div>

      <Catalog initialCategoryId={initialCategoryId} />

      <CatalogLandingsLinks />
    </main>
  );
}
