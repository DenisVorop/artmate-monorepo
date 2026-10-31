import type { ProductCategory } from "@/entities/products";
import type { CatalogSection } from "@/features/catalog";
import { routes } from "@/shared/constants";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

type HeroProps = {
  category?: ProductCategory;
  section?: CatalogSection;
};

export function Hero({ category, section }: HeroProps) {
  return (
    <section className="container border-b border-border/70 py-6 md:py-8">
      <div className="space-y-4">
        <CatalogBreadcrumbs category={category} section={section} />
        <div className="space-y-3">
          <div className="flex items-center gap-3 md:gap-5">
            <PageTitle className="min-w-0">
              {category?.title ??
                (section === "colorings" ? "Раскраски Artmate" : "Каталог Artmate")}
            </PageTitle>
            <svg
              viewBox="0 0 100 76"
              aria-hidden="true"
              focusable="false"
              className="pointer-events-none h-12 w-16 shrink-0 text-rose-400 md:h-16 md:w-20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 59C23 63 46 59 49 47C53 33 33 33 34 45C35 57 56 59 67 52" />
              <path d="M64 9L68 24L83 27L69 32L65 47L60 33L46 29L59 24Z" />
              <path d="M88 43L90 50L97 52L90 55L88 62L85 55L78 53L85 50Z" />
              <path d="M30 14L32 19M38 9L38 15" className="text-rose-300" />
            </svg>
          </div>
          {!category && (
            <SectionSubtitle className="max-w-2xl">
              {section === "colorings"
                ? "Раскраски по номерам и пиксельные раскраски"
                : "Раскраски и материалы для рисования"}
            </SectionSubtitle>
          )}
        </div>
      </div>
    </section>
  );
}

function CatalogBreadcrumbs({ category, section }: HeroProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={routes.home}>Главная</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {category || section ? (
            <BreadcrumbLink asChild>
              <Link href={routes.catalog}>Каталог</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Каталог</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {section === "colorings" && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {category ? (
                <BreadcrumbLink asChild>
                  <Link href={routes.catalogColorings}>Раскраски</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>Раскраски</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}
        {category && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{category.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
