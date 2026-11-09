"use client";

import { lazy, Suspense, useCallback, useState, type ComponentType } from "react";
import { CommunityWorkCard, useFeaturedCollectionWorks } from "@/entities/community-work";
import { LikeButton } from "@/features/likes";
import { homeCommunityCollectionSlugs } from "../lib/constants";
import { useImagePreview } from "../lib/use-image-preview";
import { PreviewLoading } from "./preview-loading";

const loadImagePreview = () =>
  import("./image-preview").then((module) => ({ default: module.ImagePreview }));
const ImagePreview = lazy(loadImagePreview);
type PreviewComponent = ComponentType<{ preview: ReturnType<typeof useImagePreview> }>;

export function HomeCommunity() {
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
  const Preview = LoadedPreview ?? ImagePreview;
  const featuredWorks = homeCommunityCollectionSlugs
    .map((slug) => works.find((work) => work.official.collection.slug === slug))
    .filter((work) => work !== undefined);
  if (!featuredWorks.length) return null;

  return (
    <>
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
              likeAction={
                <LikeButton
                  subject={{ subjectType: "community-work", subjectId: work.publicId }}
                  title={work.official.coloring.title}
                  appearance="surface"
                />
              }
            />
          </li>
        ))}
      </ul>
      {(LoadedPreview || preview.selectedWork) && (
        <Suspense fallback={<PreviewLoading preview={preview} />}>
          <Preview preview={preview} />
        </Suspense>
      )}
    </>
  );
}
