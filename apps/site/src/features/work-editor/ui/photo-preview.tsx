"use client";

import Image from "next/image";

import { OwnerAssetImage } from "@/entities/workshop";

type PhotoPreviewProps = {
  objectUrl?: string;
  revisionId?: string;
  alt: string;
};

export function PhotoPreview({ objectUrl, revisionId, alt }: PhotoPreviewProps) {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200">
      {objectUrl ? (
        <Image fill unoptimized src={objectUrl} alt={alt} className="object-contain" />
      ) : revisionId ? (
        <OwnerAssetImage revisionId={revisionId} variant="web" alt={alt} className="object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-stone-500">
          Выберите фотографию готовой физической раскраски
        </div>
      )}
    </div>
  );
}
