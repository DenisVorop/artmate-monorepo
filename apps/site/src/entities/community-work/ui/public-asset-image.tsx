"use client";

import Image from "next/image";
import { useState } from "react";
import { getPublicAssetSrcSet } from "../lib/image";

type PublicAssetImageProps = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export function PublicAssetImage({ src, alt, className, priority, sizes }: PublicAssetImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  if (failedSrc === src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-stone-100 p-4 text-center text-sm text-stone-500">
        Фото временно недоступно
      </div>
    );
  }

  return (
    <picture className="absolute inset-0">
      {sizes && !src.includes("/contests/works/") && (
        <source type="image/webp" srcSet={getPublicAssetSrcSet(src)} sizes={sizes} />
      )}
      <Image
        fill
        unoptimized
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        onError={() => setFailedSrc(src)}
        className={className ?? "object-contain"}
      />
    </picture>
  );
}
