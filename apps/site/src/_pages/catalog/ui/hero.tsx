import type { ProductCategory } from "@/entities/products";
import type { CatalogSection } from "@/features/catalog";
import { routes } from "@/shared/constants";
import { PageHero } from "@/shared/ui";

type HeroProps = {
  category?: ProductCategory;
  section?: CatalogSection;
};

export function Hero({ category, section }: HeroProps) {
  return (
    <section className="container py-5 md:py-8">
      <PageHero
        breadcrumbs={[
          { label: "Главная", href: routes.home },
          { label: "Каталог", ...(category || section ? { href: routes.catalog } : {}) },
          ...(section === "colorings"
            ? [{ label: "Раскраски", ...(category ? { href: routes.catalogColorings } : {}) }]
            : []),
          ...(category ? [{ label: category.title }] : []),
        ]}
        title={
          category?.title ?? (section === "colorings" ? "Раскраски Artmate" : "Каталог Artmate")
        }
        description={
          category
            ? undefined
            : section === "colorings"
              ? "Раскраски по номерам и пиксельные раскраски"
              : "Альбомы с раскрасками по номерам и маркеры Artmate. Посмотрите иллюстрации, сравните характеристики и цены и выберите всё для раскрашивания."
        }
      />
    </section>
  );
}
