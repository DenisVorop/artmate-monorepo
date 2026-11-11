"use client";

import { lazy, Suspense, useCallback, useState, type ComponentType } from "react";
import { CommunityWorkCard, useFeaturedCollectionWorks } from "@/entities/community-work";
import { LikeButton } from "@/features/likes";
import {
  homeCommunityCollectionSlugs,
  homeCommunityItemClassName,
  homeCommunityListClassName,
} from "../lib/constants";
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
      <ul className={homeCommunityListClassName}>
        {featuredWorks.map((work) => (
          <li key={work.publicId} className={homeCommunityItemClassName}>
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
