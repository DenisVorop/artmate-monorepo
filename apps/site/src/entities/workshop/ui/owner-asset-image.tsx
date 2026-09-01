"use client";

import Image from "next/image";

import { useOwnerAsset } from "../model";

type OwnerAssetImageProps = {
  revisionId: string;
  alt: string;
  variant?: "normalized" | "web" | "thumb";
  className?: string;
  priority?: boolean;
};

export function OwnerAssetImage({
  revisionId,
  alt,
  variant = "thumb",
  className,
  priority,
}: OwnerAssetImageProps) {
  const { dataUrl, isError, isPending } = useOwnerAsset(revisionId, variant);

  if (isPending) {
    return (
      <div className="h-full w-full bg-stone-100 motion-safe:animate-pulse" aria-hidden="true" />
    );
  }

  if (isError || !dataUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-stone-100 p-4 text-center text-sm text-stone-500">
        Фото временно недоступно
      </div>
    );
  }

  return (
    <Image
      fill
      unoptimized
      src={dataUrl}
      alt={alt}
      priority={priority}
      className={className ?? "object-cover"}
    />
  );
}
