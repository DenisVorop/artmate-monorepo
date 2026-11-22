"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";
import { PublicAssetImage } from "@/entities/community-work";
import { LikeButton } from "@/features/likes";
import { Button, ResponsiveMediaViewer } from "@/shared/ui";
import { routes } from "@/shared/constants";
import { useVisibleImage } from "@/shared/lib/hooks/use-visible-image";
import { useAnalytics } from "../lib/analytics";
import type { useImagePreview } from "../lib/use-image-preview";

export function ImagePreview({ preview }: { preview: ReturnType<typeof useImagePreview> }) {
  const analytics = useAnalytics();
  const photo = useRef<HTMLDivElement>(null);
  const publicId = preview.selectedWork?.publicId;
  useVisibleImage(
    photo,
    publicId ?? "",
    () => {
      if (publicId) analytics.photoViewed(publicId);
    },
    preview.isOpen && Boolean(publicId),
  );
  const actions = preview.selectedWork ? (
    <div className="flex shrink-0 flex-col gap-3 rounded-xl border border-rose-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex-1">
        <p className="min-w-0 text-sm font-semibold text-stone-700">
          {preview.selectedWork.official.collection.title}
        </p>
        <LikeButton
          subject={{
            subjectType: "community-work",
            subjectId: preview.selectedWork.publicId,
          }}
          title={preview.selectedWork.official.coloring.title}
          appearance="surface"
        />
      </div>
      <Button
        asChild
        size="lg"
        className="min-h-12 w-full bg-gradient-to-r from-rose-500 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500 focus-visible:ring-rose-400/30 sm:w-auto sm:px-6"
      >
        <Link
          href={routes.product(
            preview.selectedWork.relatedProduct.categorySlug,
            preview.selectedWork.relatedProduct.slug,
          )}
          aria-label={`Посмотреть альбом: ${preview.selectedWork.relatedProduct.title}`}
          data-site-action="gallery_album_open"
          data-site-product-link=""
          onClick={() => preview.onOpenChange(false)}
        >
          Посмотреть альбом <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  ) : null;
  return (
    <ResponsiveMediaViewer
      mobileFooter={actions}
      open={preview.isOpen}
      onOpenChange={preview.onOpenChange}
      returnFocusRef={preview.triggerRef}
      title={preview.selectedWork?.official.coloring.title ?? "Работа участника"}
      description={
        preview.selectedWork
          ? `Работа ${preview.selectedWork.author.name}. ${preview.selectedWork.official.collection.title}`
          : "Просмотр изображения"
      }
    >
      {preview.selectedWork && (
        <div className="flex min-h-0 flex-1 flex-col p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div ref={photo} className="relative min-h-[36dvh] flex-1 md:min-h-0">
            <PublicAssetImage
              src={preview.selectedWork.submission.assets.web}
              alt={`Работа ${preview.selectedWork.author.name}: ${preview.selectedWork.official.coloring.title}`}
              className="object-contain"
              priority
              sizes="(min-width: 1362px) 1200px, 94vw"
            />
          </div>
          <div className="mt-3 hidden md:block">{actions}</div>
        </div>
      )}
    </ResponsiveMediaViewer>
  );
}
