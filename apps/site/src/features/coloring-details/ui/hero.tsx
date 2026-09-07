import { Sparkles } from "lucide-react";

import type { Coloring } from "@/entities/coloring";
import { routes } from "@/shared/constants";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  ExpandableText,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle, SectionSubtitle } from "@/shared/ui/typography";

type HeroProps = {
  collection: Coloring["collection"];
  description: Coloring["description"];
  title: string;
};

export function Hero({ collection, description, title }: HeroProps) {
  const collectionHref = routes.digitalCollection(collection.slug);

  return (
    <section className="container space-y-6 py-5 md:space-y-8 md:py-8">
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
              <Link href={routes.colorings}>Цифровые версии</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={collectionHref}>{collection.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="max-w-3xl">
        <div className="space-y-3">
          <Badge variant="secondary" className="h-auto gap-1.5 px-3 py-1.5 text-rose-700">
            <Sparkles aria-hidden="true" />
            Цифровая версия в палитре Artmate
          </Badge>
          <PageTitle>{title}</PageTitle>
          {description && (
            <ExpandableText collapsible={description.length > 700}>
              <SectionSubtitle>{description}</SectionSubtitle>
            </ExpandableText>
          )}
        </div>
      </div>
    </section>
  );
}
