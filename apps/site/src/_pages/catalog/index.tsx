import type { ReactNode } from "react";
import { Catalog, type CatalogSection } from "@/features/catalog";
import { CatalogLandingsLinks } from "@/features/catalog-landings-links";
import type { ProductCategory } from "@/entities/products";
import { Skeleton } from "@/shared/ui/skeleton";
import { Hero } from "./ui/hero";
import { CollectionDivider } from "./ui/collection-divider";

type CatalogPageProps = {
  category?: ProductCategory;
  initialCategoryId?: string;
  section?: CatalogSection;
  children?: ReactNode;
};

export function CatalogPage({ category, initialCategoryId, section, children }: CatalogPageProps) {
  return (
    <main className="bg-background">
      <Hero category={category} section={section} />

      {children ?? <CatalogPageBody initialCategoryId={initialCategoryId} section={section} />}
    </main>
  );
}

export function CatalogPageBody({
  initialCategoryId,
  section,
}: Pick<CatalogPageProps, "initialCategoryId" | "section">) {
  return (
    <>
      <Catalog initialCategoryId={initialCategoryId} section={section} />
      {section !== "markers" && <CatalogLandingsLinks decoration={<CollectionDivider />} />}
    </>
  );
}

export function CatalogPageLoading() {
  return (
    <section
      className="container min-h-[70vh] space-y-5 py-6"
      aria-busy="true"
      aria-label="Загрузка товаров"
    >
      <Skeleton className="h-11 w-full" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-[3/4]" />
        ))}
      </div>
    </section>
  );
}
