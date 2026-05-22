"use client";

import { useCallback, useState, type SyntheticEvent } from "react";
import Image from "next/image";

import { cn } from "@/shared/lib/utils";
import { AspectRatio, Card } from "@/shared/ui";

type ArticleImageProps = {
  src: string;
  alt: string;
  caption?: string;
};

type ImageOrientation = "landscape" | "portrait" | "square";

type ImageMetrics = {
  src: string;
  ratio: number;
  orientation: ImageOrientation;
};

const fallbackRatio = 16 / 9;

export function ArticleImage({ src, alt, caption }: ArticleImageProps) {
  const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
  const activeMetrics = metrics?.src === src ? metrics : null;
  const orientation = activeMetrics?.orientation ?? "landscape";
  const ratio = activeMetrics?.ratio ?? fallbackRatio;

  const handleLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const { naturalHeight, naturalWidth } = event.currentTarget;

      if (!naturalHeight || !naturalWidth) {
        return;
      }

      const nextMetrics = {
        src,
        ratio: naturalWidth / naturalHeight,
        orientation: getImageOrientation(naturalWidth, naturalHeight),
      };

      setMetrics((currentMetrics) => {
        if (
          currentMetrics?.src === nextMetrics.src &&
          currentMetrics.ratio === nextMetrics.ratio &&
          currentMetrics.orientation === nextMetrics.orientation
        ) {
          return currentMetrics;
        }

        return nextMetrics;
      });
    },
    [src],
  );

  return (
    <Card
      className={cn(
        "overflow-hidden py-0 transition-[max-width] duration-300",
        orientation === "landscape" && "w-full",
        orientation === "portrait" && "mx-auto w-full sm:max-w-md",
        orientation === "square" && "mx-auto w-full sm:max-w-lg",
      )}
    >
      <figure>
        <AspectRatio ratio={ratio} className="relative bg-muted">
          <Image
            fill
            src={src}
            alt={alt}
            sizes={getImageSizes(orientation)}
            className="object-cover"
            onLoad={handleLoad}
          />
        </AspectRatio>
        {caption ? (
          <figcaption className="border-t px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    </Card>
  );
}

function getImageOrientation(width: number, height: number): ImageOrientation {
  const ratio = width / height;

  if (ratio > 1.05) {
    return "landscape";
  }

  if (ratio < 0.95) {
    return "portrait";
  }

  return "square";
}

function getImageSizes(orientation: ImageOrientation) {
  if (orientation === "portrait") {
    return "(min-width: 640px) 448px, 100vw";
  }

  if (orientation === "square") {
    return "(min-width: 640px) 512px, 100vw";
  }

  return "(min-width: 1280px) 720px, (min-width: 768px) 80vw, 100vw";
}
