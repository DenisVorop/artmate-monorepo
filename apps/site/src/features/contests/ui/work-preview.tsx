"use client";

import Image from "next/image";
import type { RefObject } from "react";

import { routes } from "@/shared/constants";
import { Button, CtaGradientLink, ResponsiveMediaViewer } from "@/shared/ui";

import type { ContestWork } from "../lib/types";
import { LikeButton } from "@/features/likes";

export function WorkPreview({
  work,
  onClose,
  returnFocusRef,
}: {
  work?: ContestWork;
  onClose(): void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const albumLink = work ? (
    <Button
      asChild
      size="lg"
      className="min-h-12 w-full border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 text-white"
    >
      <CtaGradientLink href={routes.product(work.product.categorySlug, work.product.slug)}>
        Посмотреть альбом
      </CtaGradientLink>
    </Button>
  ) : null;
  return (
    <ResponsiveMediaViewer
      mobileFooter={albumLink}
      returnFocusRef={returnFocusRef}
      open={Boolean(work)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={work?.title ?? "Работа участника"}
      description={work ? `${work.author}. Альбом «${work.albumTitle}»` : "Фотография раскраски"}
    >
      {work && (
        <div className="flex flex-col md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)] md:overflow-y-auto">
          <div className="relative h-[52dvh] min-h-64 shrink-0 bg-stone-100 md:h-[min(75dvh,50rem)]">
            <Image
              src={work.image}
              alt={work.title}
              fill
              unoptimized
              sizes="(min-width: 768px) 60vw, 100vw"
              className="object-contain"
            />
          </div>
          <div className="space-y-6 p-6">
            <div className="space-y-2">
              <h2 className="font-heading text-2xl leading-snug font-bold">{work.title}</h2>
              <p className="text-base text-stone-600">{work.author}</p>
              <LikeButton
                subject={{ subjectType: "contest-work", subjectId: work.id }}
                title={work.title}
                appearance="surface"
              />
            </div>
            <dl className="space-y-4 border-y border-stone-200 py-5">
              <div>
                <dt className="text-sm text-stone-500">Альбом</dt>
                <dd className="mt-1 font-semibold">{work.albumTitle}</dd>
              </div>
              {work.number && (
                <div>
                  <dt className="text-sm text-stone-500">Картинка</dt>
                  <dd className="mt-1 font-semibold">№ {work.number}</dd>
                </div>
              )}
            </dl>
            <div className="hidden md:block">{albumLink}</div>
          </div>
        </div>
      )}
    </ResponsiveMediaViewer>
  );
}
