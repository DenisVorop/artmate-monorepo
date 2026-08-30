"use client";

import { ImageOff, LoaderCircle, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useCallback, useReducer, useRef, useState, type MouseEvent } from "react";

import type { Coloring } from "@/entities/coloring";
import { Button } from "@/shared/ui";

import {
  areComparisonImagesReady,
  comparisonImageReducer,
  createComparisonImageState,
  getComparisonLiveText,
} from "../lib/comparison-state";
import { ComparisonSlider } from "./comparison-slider";

type ComparisonViewerProps = Pick<Coloring, "colored" | "height" | "outline" | "width">;

export function ComparisonViewer({ colored, height, outline, width }: ComparisonViewerProps) {
  const viewerStatusRef = useRef<HTMLDivElement>(null);
  const mainRetryButtonRef = useRef<HTMLButtonElement>(null);
  const [outlinePercent, setOutlinePercent] = useState(50);
  const [committedText, setCommittedText] = useState("");
  const [imageState, dispatchImage] = useReducer(
    comparisonImageReducer,
    undefined,
    createComparisonImageState,
  );
  const isComparisonReady = areComparisonImagesReady(imageState);
  const handleMainImageError = useCallback(() => {
    dispatchImage({ type: "failed", attempt: imageState.attempt });
  }, [imageState.attempt]);

  const commit = (value: number) => {
    setCommittedText(getComparisonLiveText(value));
  };
  const selectExtreme = (value: number) => {
    setOutlinePercent(value);
    commit(value);
  };
  const retryImages = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0 && document.activeElement === mainRetryButtonRef.current) {
      viewerStatusRef.current?.focus({ preventScroll: true });
    }

    dispatchImage({ type: "retry" });
  };

  return (
    <div className="space-y-4">
      <div
        ref={viewerStatusRef}
        role="group"
        tabIndex={-1}
        aria-label="Область сравнения контура и цветной версии"
        className="relative isolate rounded-2xl bg-stone-100 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.45)] ring-1 ring-stone-900/10 outline-none focus-visible:ring-4 focus-visible:ring-rose-400/40 focus-visible:ring-offset-2"
        style={{ aspectRatio: `${width} / ${height}` }}
        aria-busy={!isComparisonReady && !imageState.hasError}
      >
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <Image
            key={`colored-${imageState.attempt}`}
            src={colored.url}
            alt={colored.alt}
            width={width}
            height={height}
            preload
            loading="eager"
            unoptimized
            draggable={false}
            className="absolute inset-0 size-full object-contain"
            onLoad={() =>
              dispatchImage({ type: "loaded", kind: "colored", attempt: imageState.attempt })
            }
            onError={handleMainImageError}
          />
          <div
            className="absolute inset-0 overflow-hidden motion-reduce:transition-none"
            style={{ clipPath: `inset(0 ${100 - outlinePercent}% 0 0)` }}
            aria-hidden="true"
          >
            <Image
              key={`outline-${imageState.attempt}`}
              src={outline.url}
              alt=""
              width={width}
              height={height}
              unoptimized
              loading="eager"
              draggable={false}
              className="absolute inset-0 size-full object-contain"
              onLoad={() =>
                dispatchImage({ type: "loaded", kind: "outline", attempt: imageState.attempt })
              }
              onError={handleMainImageError}
            />
          </div>

          {!imageState.hasError && !isComparisonReady && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-stone-100/90 p-6 text-center"
              role="status"
            >
              <LoaderCircle className="size-8 animate-spin text-rose-500 motion-reduce:animate-none" />
              <p className="max-w-xs font-medium">Загружаем изображение</p>
            </div>
          )}

          {imageState.hasError && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-stone-100/95 p-6 text-center"
              role="alert"
              aria-atomic="true"
            >
              <ImageOff className="size-8 text-stone-500" aria-hidden="true" />
              <p className="max-w-xs font-medium">Не удалось загрузить изображение</p>
              <Button
                ref={mainRetryButtonRef}
                type="button"
                variant="outline"
                className="min-h-11 min-w-11"
                onClick={retryImages}
              >
                <RotateCcw data-icon="inline-start" />
                Повторить
              </Button>
            </div>
          )}
        </div>

        {isComparisonReady && (
          <span
            aria-hidden="true"
            data-comparison-divider
            className="pointer-events-none absolute inset-y-0 z-10 w-px -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(28,25,23,0.15)]"
            style={{ left: `${outlinePercent}%` }}
          />
        )}
        <ComparisonSlider
          placement="image"
          value={outlinePercent}
          disabled={!isComparisonReady}
          onValueChange={setOutlinePercent}
          onValueCommit={commit}
        />
      </div>

      <div className="relative h-11 overflow-visible" data-comparison-track>
        <ComparisonSlider
          placement="below"
          value={outlinePercent}
          disabled={!isComparisonReady}
          onValueChange={setOutlinePercent}
          onValueCommit={commit}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11 px-3 focus-visible:ring-rose-400/40"
          disabled={!isComparisonReady}
          onClick={() => selectExtreme(0)}
        >
          В цвете
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11 px-3 focus-visible:ring-rose-400/40"
          disabled={!isComparisonReady}
          onClick={() => selectExtreme(100)}
        >
          Контур
        </Button>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {committedText}
      </p>
    </div>
  );
}
