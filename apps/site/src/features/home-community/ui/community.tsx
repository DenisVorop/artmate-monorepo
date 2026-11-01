"use client";

import { lazy, Suspense, useCallback, useEffect, useState, type ComponentType } from "react";
import { CommunityWorkCard, useFeaturedCollectionWorks } from "@/entities/community-work";
import { SectionTitle } from "@/shared/ui/typography";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { scheduleIdlePreload } from "@/shared/lib/schedule-idle-preload";
import { homeCommunityCollectionSlugs } from "../lib/constants";
import { useImagePreview } from "../lib/use-image-preview";
import { PreviewLoading } from "./preview-loading";

const loadImagePreview = () =>
  import("./image-preview").then((module) => ({ default: module.ImagePreview }));
const ImagePreview = lazy(loadImagePreview);
type PreviewComponent = ComponentType<{ preview: ReturnType<typeof useImagePreview> }>;

export function HomeCommunity({ className }: { className?: string }) {
  const { works } = useFeaturedCollectionWorks(homeCommunityCollectionSlugs);
  const preview = useImagePreview();
  const [LoadedPreview, setLoadedPreview] = useState<PreviewComponent | null>(null);
  const preloadImagePreview = useCallback(
    () =>
      loadImagePreview()
        .then((module) => setLoadedPreview(() => module.default))
        .catch(() => undefined),
    [],
  );
  useEffect(() => scheduleIdlePreload(preloadImagePreview), [preloadImagePreview]);
  const Preview = LoadedPreview ?? ImagePreview;
  const featuredWorks = homeCommunityCollectionSlugs
    .map((slug) => works.find((work) => work.official.collection.slug === slug))
    .filter((work) => work !== undefined);
  if (!featuredWorks.length) return null;

  return (
    <section className={cn("container", className)} aria-labelledby="home-community-title">
      <div className="mb-5 flex items-center justify-between gap-4 md:mb-6">
        <SectionTitle
          id="home-community-title"
          style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)" }}
        >
          Работы участников
        </SectionTitle>
        <Button asChild variant="link" className="min-h-11 shrink-0 text-rose-600">
          <Link href={routes.gallery}>Все работы</Link>
        </Button>
      </div>
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:gap-5 md:grid md:grid-cols-4">
        {featuredWorks.map((work) => (
          <li
            key={work.publicId}
            className="min-w-0 shrink-0 basis-[46%] snap-start sm:basis-[32%] md:basis-auto"
          >
            <CommunityWorkCard
              work={work}
              onPreviewIntent={preloadImagePreview}
              onOpenImage={(event) => preview.openImage(work, event.currentTarget)}
            />
          </li>
        ))}
      </ul>
      {(LoadedPreview || preview.selectedWork) && (
        <Suspense fallback={<PreviewLoading preview={preview} />}>
          <Preview preview={preview} />
        </Suspense>
      )}
    </section>
  );
}
