import { Catalog, type CatalogSection } from "@/features/catalog";
import { CatalogLandingsLinks } from "@/features/catalog-landings-links";
import type { ProductCategory } from "@/entities/products";
import { Hero } from "./ui/hero";
import { CollectionDivider } from "./ui/collection-divider";

type CatalogPageProps = {
  category?: ProductCategory;
  initialCategoryId?: string;
  section?: CatalogSection;
};

export function CatalogPage({ category, initialCategoryId, section }: CatalogPageProps) {
  return (
    <main className="bg-background">
      <Hero category={category} section={section} />

      <Catalog initialCategoryId={initialCategoryId} section={section} />

      {section !== "markers" && <CatalogLandingsLinks decoration={<CollectionDivider />} />}
    </main>
  );
}
