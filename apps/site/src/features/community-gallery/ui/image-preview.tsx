"use client";

import { ArrowUpRight } from "lucide-react";

import { getCommunityCollectionTitle, PublicAssetImage } from "@/entities/community-work";
import { getProductBySlug, useProductsData } from "@/entities/products";
import { routes } from "@/shared/constants";
import { Avatar, AvatarFallback, AvatarImage, ResponsiveMediaViewer } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import type { useImagePreview } from "../lib/use-image-preview";
import { AlbumCard } from "./album-card";

export function ImagePreview({ preview }: { preview: ReturnType<typeof useImagePreview> }) {
  const work = preview.selectedWork;
  const { data: productsData } = useProductsData();
  const product = work
    ? getProductBySlug(productsData?.products ?? [], work.relatedProduct.slug)
    : undefined;
  return (
    <ResponsiveMediaViewer
      open={preview.isOpen}
      onOpenChange={preview.onOpenChange}
      returnFocusRef={preview.triggerRef}
      title={work?.official.coloring.title ?? "Работа участника"}
      description={
        work
          ? `Работа ${work.author.name}. ${work.official.collection.title}`
          : "Просмотр фотографии"
      }
    >
      {work && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)] md:overflow-hidden">
          <div className="relative h-[52dvh] min-h-64 shrink-0 bg-stone-100 md:h-full md:min-h-0">
            <PublicAssetImage
              key={work.revisionId}
              src={work.submission.assets.web}
              alt={`Работа ${work.author.name}: ${work.official.coloring.title}`}
              className="object-contain"
              priority
              sizes="(min-width: 1362px) 768px, (min-width: 768px) 56.4vw, 100vw"
            />
          </div>
          <div className="space-y-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:overflow-y-auto lg:p-7">
            <div className="space-y-2">
              <h2 className="font-heading text-xl leading-snug font-bold text-stone-900 sm:text-2xl">
                {work.official.coloring.title}
              </h2>
            </div>
            <Link
              href={routes.publicWorkshop(work.author.handle)}
              className="flex w-fit items-center gap-3 rounded-lg text-sm font-semibold text-stone-800 underline-offset-4 hover:underline"
              onClick={() => preview.onOpenChange(false)}
            >
              <Avatar className="size-9">
                {work.author.image && <AvatarImage src={work.author.image} alt="" />}
                <AvatarFallback>{work.author.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              {work.author.name}
            </Link>
            <dl className="grid grid-cols-2 gap-4 border-y border-stone-200 py-4 text-sm">
              <div className="space-y-1">
                <dt className="text-xs text-stone-500">Тематика</dt>
                <dd className="font-medium text-stone-800">
                  {getCommunityCollectionTitle(work.official.collection.title)}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-stone-500">Картинка</dt>
                <dd className="font-medium text-stone-800">№ {work.official.coloring.number}</dd>
              </div>
            </dl>
            <time className="block text-xs text-stone-500" dateTime={work.submission.publishedAt}>
              {new Intl.DateTimeFormat("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(work.submission.publishedAt))}
            </time>
            {work.submission.caption && (
              <p className="border-t border-stone-200 pt-4 text-sm leading-6 whitespace-pre-wrap text-stone-700">
                {work.submission.caption}
              </p>
            )}
            <div className="flex flex-col gap-3 pt-1">
              <AlbumCard
                product={product}
                relatedProduct={work.relatedProduct}
                onNavigate={() => preview.onOpenChange(false)}
              />
              <Link
                href={routes.coloring(work.official.collection.slug, work.official.coloring.number)}
                className="flex min-h-11 w-fit items-center gap-2 text-sm text-stone-600 underline-offset-4 hover:underline focus-visible:underline"
                onClick={() => preview.onOpenChange(false)}
              >
                Цифровая версия картинки <ArrowUpRight className="size-4" />
              </Link>
              <Link
                href={routes.publicWork(work.publicId)}
                className="flex min-h-11 w-fit items-center gap-2 text-sm text-stone-500 underline-offset-4 hover:underline focus-visible:underline"
                onClick={() => preview.onOpenChange(false)}
              >
                Страница работы <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </ResponsiveMediaViewer>
  );
}
