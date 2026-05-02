import { Catalog } from "@/features/catalog";
import { Separator } from "@/shared/ui";
import { Hero } from "./ui/hero";

type CatalogPageProps = {
  initialCategoryId?: string;
};

export function CatalogPage({ initialCategoryId }: CatalogPageProps) {
  return (
    <main className="bg-background">
      <Hero />

      <div className="container">
        <Separator />
      </div>

      <Catalog initialCategoryId={initialCategoryId} />
    </main>
  );
}
