"use client";
import { getProductBySlug, useProductsData } from "@/entities/products";
import { PublicAssetImage, type ContestGalleryWork } from "@/entities/community-work";
import { LikeButton } from "@/features/likes";
import { routes } from "@/shared/constants";
import { ResponsiveMediaViewer } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import type { useImagePreview } from "../lib/use-image-preview";
import { AlbumCard, AlbumLink } from "./album-card";
export function ContestImagePreview({
  preview,
  work,
}: {
  preview: ReturnType<typeof useImagePreview>;
  work: ContestGalleryWork;
}) {
  const { data } = useProductsData();
  const product = getProductBySlug(data?.products ?? [], work.relatedProduct.slug);
  return (
    <ResponsiveMediaViewer
      open={preview.isOpen}
      onOpenChange={preview.onOpenChange}
      returnFocusRef={preview.triggerRef}
      mobileFooter={
        work ? (
          <AlbumLink
            product={product}
            relatedProduct={work.relatedProduct}
            onNavigate={() => preview.onOpenChange(false)}
          />
        ) : undefined
      }
      title={work.title}
      description={`${work.author.name}. ${work.album.title}`}
    >
      <div className="flex flex-col md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)] md:items-start md:overflow-y-auto md:overscroll-contain">
        <div className="relative h-[52dvh] min-h-64 shrink-0 bg-stone-100 md:h-[min(calc(92dvh-3.5rem),60.5rem)]">
          <PublicAssetImage
            src={work.submission.assets.web}
            alt={work.title}
            className="object-contain"
            priority
          />
        </div>
        <div className="min-w-0 space-y-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:p-7">
          <h2 className="font-heading text-xl leading-snug font-bold sm:text-2xl">{work.title}</h2>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{work.author.name}</p>
            <LikeButton
              subject={{ subjectType: "contest-work", subjectId: work.publicId }}
              title={work.title}
              appearance="surface"
            />
          </div>
          <dl className="space-y-3 border-y border-stone-200 py-4 text-sm">
            <div>
              <dt className="text-stone-500">Альбом</dt>
              <dd className="mt-1 font-medium">{work.album.title}</dd>
            </div>
            {work.number && (
              <div>
                <dt className="text-stone-500">Картинка</dt>
                <dd className="mt-1 font-medium">№ {work.number}</dd>
              </div>
            )}
            <div>
              <dt className="text-stone-500">Конкурс</dt>
              <dd className="mt-1">
                <Link
                  href={routes.contest(work.contest.slug)}
                  className="underline underline-offset-4"
                  onClick={() => preview.onOpenChange(false)}
                >
                  {work.contest.title}
                </Link>
              </dd>
            </div>
          </dl>
          <AlbumCard
            product={product}
            relatedProduct={work.relatedProduct}
            onNavigate={() => preview.onOpenChange(false)}
          />
        </div>
      </div>
    </ResponsiveMediaViewer>
  );
}
