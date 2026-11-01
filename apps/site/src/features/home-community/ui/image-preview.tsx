"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PublicAssetImage } from "@/entities/community-work";
import { Button, ResponsiveMediaViewer } from "@/shared/ui";
import { routes } from "@/shared/constants";
import type { useImagePreview } from "../lib/use-image-preview";

export function ImagePreview({ preview }: { preview: ReturnType<typeof useImagePreview> }) {
  return (
    <ResponsiveMediaViewer
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
          <div className="relative min-h-0 flex-1">
            <PublicAssetImage
              src={preview.selectedWork.submission.assets.web}
              alt={`Работа ${preview.selectedWork.author.name}: ${preview.selectedWork.official.coloring.title}`}
              className="object-contain"
              priority
              sizes="(min-width: 1362px) 1200px, 94vw"
            />
          </div>
          <div className="mt-3 flex shrink-0 flex-col gap-3 rounded-xl border border-rose-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <p className="min-w-0 text-sm font-semibold text-stone-700">
              {preview.selectedWork.official.collection.title}
            </p>
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
                onClick={() => preview.onOpenChange(false)}
              >
                Посмотреть альбом <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </ResponsiveMediaViewer>
  );
}
