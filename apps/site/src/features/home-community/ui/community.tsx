"use client";

import dynamic from "next/dynamic";
import { CommunityWorkCard, useFeaturedCollectionWorks } from "@/entities/community-work";
import { SectionTitle } from "@/shared/ui/typography";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { homeCommunityCollectionSlugs } from "../lib/constants";
import { useImagePreview } from "../lib/use-image-preview";

const ImagePreview = dynamic(() => import("./image-preview").then((module) => module.ImagePreview));

export function HomeCommunity({ className }: { className?: string }) {
  const { works } = useFeaturedCollectionWorks(homeCommunityCollectionSlugs);
  const preview = useImagePreview();
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
              onOpenImage={(event) => preview.openImage(work, event.currentTarget)}
            />
          </li>
        ))}
      </ul>
      {preview.selectedWork && <ImagePreview preview={preview} />}
    </section>
  );
}
