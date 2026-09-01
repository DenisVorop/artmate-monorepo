"use client";

import { useState } from "react";
import Image from "next/image";

import { OwnerAssetImage } from "@/entities/workshop";

import { getCropPreviewGeometry } from "../lib";

type PhotoPreviewProps = {
  objectUrl?: string;
  revisionId?: string;
  alt: string;
  crop?: { rotation: 0 | 90 | 180 | 270; zoom: number; x: number; y: number };
};

export function PhotoPreview({ objectUrl, revisionId, alt, crop }: PhotoPreviewProps) {
  const [source, setSource] = useState<{
    url: string;
    width: number;
    height: number;
  }>();
  const geometry =
    objectUrl && crop && source?.url === objectUrl
      ? getCropPreviewGeometry(source.width, source.height, crop)
      : undefined;
  const className = "object-cover transition-transform duration-150";

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200">
      {objectUrl ? (
        <div
          className={geometry ? "absolute" : "absolute inset-0"}
          style={
            geometry
              ? {
                  left: `${geometry.imageCenterXPercent}%`,
                  top: `${geometry.imageCenterYPercent}%`,
                  width: `${geometry.imageWidthPercent}%`,
                  height: `${geometry.imageHeightPercent}%`,
                  transform: "translate(-50%, -50%)",
                }
              : undefined
          }
        >
          <div
            className="relative size-full transition-transform duration-150"
            style={{ transform: geometry ? `rotate(${crop?.rotation ?? 0}deg)` : undefined }}
          >
            <Image
              fill
              unoptimized
              src={objectUrl}
              alt={alt}
              className={geometry ? undefined : className}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;

                if (naturalWidth > 0 && naturalHeight > 0) {
                  setSource((current) => {
                    if (
                      current?.url === objectUrl &&
                      current.width === naturalWidth &&
                      current.height === naturalHeight
                    ) {
                      return current;
                    }

                    return { url: objectUrl, width: naturalWidth, height: naturalHeight };
                  });
                }
              }}
            />
          </div>
        </div>
      ) : revisionId ? (
        <OwnerAssetImage revisionId={revisionId} variant="web" alt={alt} className={className} />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-stone-500">
          Выберите фотографию готовой физической раскраски
        </div>
      )}
    </div>
  );
}
