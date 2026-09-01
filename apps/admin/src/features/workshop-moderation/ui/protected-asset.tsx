"use client";

import Image from "next/image";
import { ImageOff, RefreshCw } from "lucide-react";

import {
  useWorkshopModerationAsset,
} from "@/entities/workshop-moderation";
import { Button } from "@/shared/ui";

type ProtectedAssetProps = {
  readonly alt: string;
  readonly compact?: boolean;
  readonly label: string;
  readonly revisionId: string;
  readonly variant: "normalized" | "web" | "thumb" | "official";
};

export function ProtectedAsset({
  alt,
  compact = false,
  label,
  revisionId,
  variant,
}: ProtectedAssetProps) {
  const { dataUrl, isError, isPending, refetch } = useWorkshopModerationAsset(
    revisionId,
    variant,
  );

  return (
    <figure className="grid min-w-0 gap-2">
      <figcaption className="font-medium">{label}</figcaption>
      <div
        className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border bg-muted/30 ${compact ? "min-h-40" : "min-h-64"}`}
      >
        {isPending ? (
          <span className="animate-pulse text-sm text-muted-foreground">
            Загрузка изображения...
          </span>
        ) : isError || !dataUrl ? (
          <div className="grid justify-items-center gap-3 p-4 text-center">
            <ImageOff className="size-6 text-destructive" aria-hidden="true" />
            <p className="text-sm text-destructive">
              Не удалось загрузить защищенное изображение
            </p>
            <Button
              className="min-h-11"
              onClick={() => void refetch()}
              type="button"
              variant="outline"
            >
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
              Повторить
            </Button>
          </div>
        ) : (
          <Image
            alt={alt}
            className="object-contain"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            src={dataUrl}
            unoptimized
          />
        )}
      </div>
    </figure>
  );
}
