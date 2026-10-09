"use client";

import Image from "next/image";

import { useColoringAsset } from "@/entities/colorings";

export function ProtectedImage({
  url,
  label,
}: {
  readonly url: string;
  readonly label: string;
}) {
  const { dataUrl, isError, isPending } = useColoringAsset({ previewUrl: url });
  return (
    <figure className="grid min-w-0 gap-2">
      <figcaption className="text-sm font-medium">{label}</figcaption>
      <div className="relative flex h-72 items-center justify-center rounded-lg border bg-muted/20">
        {isPending ? (
          <p className="text-sm text-muted-foreground">
            Загружаем изображение…
          </p>
        ) : isError || !dataUrl ? (
          <p className="px-3 text-center text-sm text-destructive">
            Не удалось загрузить изображение. Обновите страницу.
          </p>
        ) : (
          <Image
            fill
            unoptimized
            src={dataUrl}
            alt={label}
            className="object-contain"
            sizes="(min-width: 1024px) 30vw, 100vw"
          />
        )}
      </div>
    </figure>
  );
}
