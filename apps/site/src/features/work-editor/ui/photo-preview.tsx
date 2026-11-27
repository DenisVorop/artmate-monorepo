"use client";

import Image from "next/image";

import { OwnerAssetImage } from "@/entities/workshop";

type PhotoPreviewProps = {
  objectUrl?: string;
  revisionId?: string;
  alt: string;
  example?: { url: string; alt: string };
};

export function PhotoPreview({ objectUrl, revisionId, alt, example }: PhotoPreviewProps) {
  const hasPhoto = Boolean(objectUrl || revisionId);

  if (!hasPhoto && !example) {
    return (
      <p className="flex min-h-24 items-center justify-center rounded-xl bg-stone-100 p-4 text-sm text-stone-600">
        Фото ещё не выбрано
      </p>
    );
  }

  return (
    <figure className="min-w-0 space-y-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
        {objectUrl ? (
          <Image fill unoptimized src={objectUrl} alt={alt} className="object-contain" />
        ) : revisionId ? (
          <OwnerAssetImage
            revisionId={revisionId}
            variant="web"
            alt={alt}
            className="object-contain"
          />
        ) : example ? (
          <Image fill unoptimized src={example.url} alt={example.alt} className="object-contain" />
        ) : null}
      </div>
      <figcaption className="text-sm text-stone-600">
        {hasPhoto ? "Ваше фото" : "Цветной образец"}
      </figcaption>
    </figure>
  );
}
