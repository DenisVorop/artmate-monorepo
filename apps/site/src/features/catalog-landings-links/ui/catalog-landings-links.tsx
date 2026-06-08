"use client";

import {
  getCatalogLandingHref,
  useCatalogLandings,
} from "@/entities/catalog-landings";
import { cn } from "@/shared/lib";
import { Link } from "@/shared/ui/link";

type CatalogLandingsLinksProps = {
  readonly className?: string;
  readonly currentSlug?: string;
  readonly maxItems?: number;
  readonly title?: string;
};

export function CatalogLandingsLinks({
  className,
  currentSlug,
  maxItems = 18,
  title = "Популярные подборки",
}: CatalogLandingsLinksProps) {
  const { isError, isPending, landings } = useCatalogLandings();
  const visibleLandings = landings
    .filter((landing) => landing.slug !== currentSlug)
    .slice(0, maxItems);

  if (isPending || isError || visibleLandings.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="catalog-landings-links-title"
      className={cn("border-t border-border/70 bg-background py-8 md:py-10", className)}
    >
      <div className="container">
        <div>
          <h2
            id="catalog-landings-links-title"
            className="mb-3 text-base font-semibold tracking-normal text-stone-900"
          >
            {title}
          </h2>

          <ul className="flex flex-wrap gap-x-3 gap-y-2 text-sm leading-6">
            {visibleLandings.map((landing, index) => (
              <li key={landing.id} className="flex items-center gap-3">
                <Link
                  className="text-muted-foreground underline-offset-4 hover:text-rose-500 hover:underline"
                  href={getCatalogLandingHref(landing.slug)}
                >
                  {landing.h1}
                </Link>
                {index < visibleLandings.length - 1 ? (
                  <span className="text-border" aria-hidden="true">
                    /
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
