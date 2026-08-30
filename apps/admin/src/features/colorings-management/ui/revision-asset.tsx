"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { useColoringAsset } from "@/entities/colorings";

export function RevisionAsset({
  alt,
  label,
  previewUrl,
}: {
  readonly alt: string;
  readonly label: string;
  readonly previewUrl: string;
}) {
  const { dataUrl, isError, isPending } = useColoringAsset({ previewUrl });

  return (
    <figure className="grid min-w-0 gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">{label}</figcaption>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
        {isPending ? (
          <span className="text-xs text-muted-foreground">Загрузка изображения...</span>
        ) : isError || !dataUrl ? (
          <span className="flex items-center gap-2 px-3 text-center text-xs text-destructive">
            <ImageIcon className="size-4 shrink-0" aria-hidden="true" />
            Не удалось загрузить защищенный файл
          </span>
        ) : (
          <Image
            alt={alt}
            className="object-contain"
            fill
            sizes="(min-width: 640px) 50vw, 100vw"
            src={dataUrl}
            unoptimized
          />
        )}
      </div>
    </figure>
  );
}
