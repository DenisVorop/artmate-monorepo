"use client";

import { ImageOff, LoaderCircle, RotateCcw } from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

import type { Coloring } from "@/entities/coloring-variants";
import { Button } from "@/shared/ui";
import { useVisibleImage } from "@/shared/lib/hooks/use-visible-image";
import type { useViewerAnalytics } from "../lib/analytics";

import {
  areComparisonImagesReady,
  comparisonImageReducer,
  createComparisonImageState,
  getComparisonLiveText,
} from "../lib/comparison-state";
import { ComparisonSlider } from "./comparison-slider";

type ComparisonViewerProps = Pick<Coloring, "height" | "width"> & {
  left: Coloring["original"]["image"];
  right: Coloring["original"]["image"];
  leftLabel: string;
  rightLabel: string;
  split: number;
  setSplit: (_value: number) => void;
  analytics?: ReturnType<typeof useViewerAnalytics>;
};

export function ComparisonViewer({
  left,
  right,
  height,
  width,
  leftLabel,
  rightLabel,
  split,
  setSplit,
  analytics,
}: ComparisonViewerProps) {
  const viewerStatusRef = useRef<HTMLDivElement>(null);
  const mainRetryButtonRef = useRef<HTMLButtonElement>(null);
  const [committedText, setCommittedText] = useState("");
  const [imageState, dispatchImage] = useReducer(
    comparisonImageReducer,
    undefined,
    createComparisonImageState,
  );
  const isComparisonReady = areComparisonImagesReady(imageState);
  useVisibleImage(viewerStatusRef, 1, () => analytics?.pictureViewed(), isComparisonReady);
  const handleMainImageError = useCallback(() => {
    dispatchImage({ type: "failed", attempt: imageState.attempt });
  }, [imageState.attempt]);

  const commit = (value: number) => {
    setCommittedText(getComparisonLiveText(value, leftLabel, rightLabel));
  };
  const adjust = (value: number) => {
    commit(value);
    analytics?.comparisonMoved(value);
  };
  const selectExtreme = (value: number) => {
    setSplit(value);
    commit(value);
    if (value === 100) analytics?.leftShown();
    else analytics?.rightShown();
  };
  const retryImages = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0 && document.activeElement === mainRetryButtonRef.current) {
      viewerStatusRef.current?.focus({ preventScroll: true });
    }

    dispatchImage({ type: "retry" });
    analytics?.imageRetried();
  };

  return (
    <div
      id="palette-viewer"
      className="mx-auto w-full space-y-4 md:max-w-[var(--comparison-max-width)]"
      style={
        {
          "--comparison-max-width": `min(100%, calc((100dvh - 8rem) * ${width / height}))`,
        } as CSSProperties
      }
    >
      <div
        ref={viewerStatusRef}
        role="group"
        tabIndex={-1}
        aria-label={`Сравнение: ${leftLabel} и ${rightLabel}`}
        className="relative isolate rounded-2xl bg-stone-100 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.45)] ring-1 ring-stone-900/10 outline-none focus-visible:ring-4 focus-visible:ring-rose-400/40 focus-visible:ring-offset-2"
        style={{ aspectRatio: `${width} / ${height}` }}
        aria-busy={!isComparisonReady && !imageState.hasError}
      >
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <Image
            key={`colored-${imageState.attempt}`}
            src={right.url}
            alt={right.alt}
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
            style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
            aria-hidden="true"
          >
            <Image
              key={`outline-${imageState.attempt}`}
              src={left.url}
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
            style={{ left: `${split}%` }}
          />
        )}
        <ComparisonSlider
          placement="image"
          leftLabel={leftLabel}
          rightLabel={rightLabel}
          value={split}
          disabled={!isComparisonReady}
          onValueChange={setSplit}
          onValueCommit={adjust}
        />
      </div>

      <div className="relative h-11 overflow-visible" data-comparison-track>
        <ComparisonSlider
          placement="below"
          leftLabel={leftLabel}
          rightLabel={rightLabel}
          value={split}
          disabled={!isComparisonReady}
          onValueChange={setSplit}
          onValueCommit={adjust}
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
          {rightLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11 px-3 focus-visible:ring-rose-400/40"
          disabled={!isComparisonReady}
          onClick={() => selectExtreme(100)}
        >
          {leftLabel}
        </Button>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {committedText}
      </p>
    </div>
  );
}
