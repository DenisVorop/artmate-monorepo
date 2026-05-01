import type { Product } from "@/entities/products";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/shared/ui";
import { routes } from "@/shared/constants";
import { Link } from "@/shared/ui/link";

type BreadcrumbsProps = {
  product: Product;
};

export function Breadcrumbs({ product }: BreadcrumbsProps) {
  const categorySlug = product.categorySlug;
  const categoryTitle = product.category;

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
          <BreadcrumbLink asChild>
            <Link href={routes.raskraski}>Раскраски</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {categorySlug && categoryTitle && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.catalogCategory(categorySlug)}>{categoryTitle}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbPage>{product.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
