import { ArrowUpRight } from "lucide-react";

import type { Coloring } from "@/entities/coloring";
import { routes } from "@/shared/constants";
import { Button, CtaGradientLink, ExpandableText, PageHero } from "@/shared/ui";

type HeroProps = {
  collection: Coloring["collection"];
  description: Coloring["description"];
  title: string;
};

export function Hero({ collection, description, title }: HeroProps) {
  const collectionHref = routes.digitalCollection(collection.slug);

  return (
    <section className="container py-5 md:py-8">
      <PageHero
        breadcrumbs={[
          { label: "Главная", href: routes.home },
          { label: "Цифровые версии", href: routes.colorings },
          { label: collection.title, href: collectionHref },
          { label: title },
        ]}
        title={title}
        description={
          description ? (
            <ExpandableText collapsible={description.length > 700}>
              <p>{description}</p>
            </ExpandableText>
          ) : undefined
        }
        actions={
          <Button
            asChild
            size="lg"
            className="min-h-11 border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 px-5 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
          >
            <CtaGradientLink
              href={routes.product(collection.product.category?.slug, collection.product.slug)}
              aria-label={`Посмотреть альбом: ${collection.product.title}`}
            >
              Посмотреть альбом
              <ArrowUpRight />
            </CtaGradientLink>
          </Button>
        }
      />
    </section>
  );
}
