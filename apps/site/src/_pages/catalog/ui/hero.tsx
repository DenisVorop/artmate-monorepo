import { Badge } from "@/shared/ui";
import type { ProductCategory } from "@/entities/products";
import { routes } from "@/shared/constants";
import { createCategoryDescription } from "@/shared/lib/seo";
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
};

export function Hero({ category }: HeroProps) {
  const title = category
    ? `${category.title} - раскраски по номерам Artmate`
    : "Выберите свою раскраску ARTMATE";
  const description = category
    ? createCategoryDescription(category.title)
    : "Подберите сюжет под\u00a0настроение, уровень детализации и\u00a0любимые материалы для\u00a0спокойного творческого вечера.";

  return (
    <section className="container py-6 md:py-8">
      <div className="space-y-5">
        {category ? <CatalogBreadcrumbs category={category} /> : null}

        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] md:gap-8">
          <div>
            <Badge variant="secondary" className="mb-6">
              {category ? "Категория" : "Каталог"}
            </Badge>
            <PageTitle className={category ? "max-w-full" : "max-w-lg"}>
              {category ? (
                title
              ) : (
                <>
                  Выберите свою раскраску <span className="text-rose-500">ARTMATE</span>
                </>
              )}
            </PageTitle>
          </div>
          <SectionSubtitle className="max-w-md pb-1 md:justify-self-end">
            {description}
          </SectionSubtitle>
        </div>
      </div>
    </section>
  );
}

function CatalogBreadcrumbs({ category }: { category: ProductCategory }) {
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
          <BreadcrumbLink asChild>
            <Link href={routes.catalog}>Каталог</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{category.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
