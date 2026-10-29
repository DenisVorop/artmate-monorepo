"use client";

import Image from "next/image";
import { useState } from "react";

type PublicAssetImageProps = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
};

export function PublicAssetImage({ src, alt, className, priority }: PublicAssetImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  if (failedSrc === src) {
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
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      onError={() => setFailedSrc(src)}
      className={className ?? "object-cover"}
    />
  );
}
