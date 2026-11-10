"use client";

import { useAnalytics } from "../lib/analytics";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/shared/ui";

import { getCatalogLandingHref, useCatalogLandings } from "@/entities/catalog-landings";
import { cn } from "@/shared/lib";
import { Link } from "@/shared/ui/link";

type CatalogLandingsLinksProps = {
  readonly className?: string;
  readonly currentSlug?: string;
  readonly decoration?: ReactNode;
  readonly maxItems?: number;
  readonly title?: string;
};

export function CatalogLandingsLinks({
  className,
  currentSlug,
  decoration,
  maxItems = 18,
  title = "Популярные подборки",
}: CatalogLandingsLinksProps) {
  const analytics = useAnalytics();
  const titleId = useId();
  const [showAll, setShowAll] = useState(false);
  const { isError, isPending, landings } = useCatalogLandings();
  const availableLandings = landings.filter((landing) => landing.slug !== currentSlug);
  const visibleLandings = showAll ? availableLandings : availableLandings.slice(0, maxItems);

  if (isPending || isError || visibleLandings.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "relative border-t border-border/70 bg-background py-8 md:py-10",
        decoration && "border-t-0",
        className,
      )}
    >
      {decoration && <div className="absolute inset-x-0 top-0 container">{decoration}</div>}
      <div className="container">
        <div>
          <h2 id={titleId} className="mb-3 text-base font-semibold tracking-normal text-stone-900">
            {title}
          </h2>

          <ul className="flex flex-wrap gap-x-3 gap-y-2 text-sm leading-6">
            {visibleLandings.map((landing, index) => (
              <li key={landing.id} className="flex items-center gap-3">
                <Link
                  className="inline-flex min-h-8 items-center text-muted-foreground underline-offset-4 hover:text-rose-500 hover:underline pointer-coarse:min-h-11"
                  href={getCatalogLandingHref(landing.slug)}
                  onClick={() => analytics.landingOpened(landing.slug)}
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
          {availableLandings.length > maxItems && (
            <Button
              type="button"
              variant="link"
              className="mt-3 px-0"
              aria-expanded={showAll}
              onClick={() => {
                if (showAll) analytics.listCollapsed();
                else analytics.listExpanded();
                setShowAll(!showAll);
              }}
            >
              {showAll ? "Свернуть" : "Все подборки"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
