"use client";

import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type UIEvent } from "react";

import {
  AspectRatio,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/shared/ui";
import { cn, shouldBypassNextImageOptimization } from "@/shared/lib";

type GalleryProps = {
  images: string[];
  title: string;
};

function getPreviousIndex(index: number, length: number) {
  return (index - 1 + length) % length;
}

function getNextIndex(index: number, length: number) {
  return (index + 1) % length;
}

function getScrollIndex(track: HTMLDivElement, length: number) {
  if (track.clientWidth === 0) {
    return 0;
  }

  return Math.min(length - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth)));
}

function scrollTrackToIndex(
  track: HTMLDivElement | null,
  index: number,
  behavior: ScrollBehavior = "smooth",
) {
  if (!track) return;

  track.scrollTo({
    left: track.clientWidth * index,
    behavior,
  });
}

export function Gallery({ images, title }: GalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const mainTrackRef = useRef<HTMLDivElement>(null);
  const lightboxTrackRef = useRef<HTMLDivElement>(null);
  const initialLightboxIndexRef = useRef(0);
  const mainScrollTargetIndexRef = useRef<number | null>(null);
  const lightboxScrollTargetIndexRef = useRef<number | null>(null);

  const hasMultipleImages = images.length > 1;
  const activeImage = images[activeIndex];
  const lightboxImage = images[lightboxIndex] ?? activeImage;

  const selectMainImage = useCallback((index: number, behavior?: ScrollBehavior) => {
    mainScrollTargetIndexRef.current = index;
    setActiveIndex(index);
    scrollTrackToIndex(mainTrackRef.current, index, behavior);
  }, []);

  const selectLightboxImage = useCallback((index: number, behavior?: ScrollBehavior) => {
    lightboxScrollTargetIndexRef.current = index;
    setLightboxIndex(index);
    scrollTrackToIndex(lightboxTrackRef.current, index, behavior);
  }, []);

  const showPrevious = useCallback(() => {
    selectMainImage(getPreviousIndex(activeIndex, images.length));
  }, [activeIndex, images.length, selectMainImage]);

  const showNext = useCallback(() => {
    selectMainImage(getNextIndex(activeIndex, images.length));
  }, [activeIndex, images.length, selectMainImage]);

  const showPreviousInLightbox = useCallback(() => {
    selectLightboxImage(getPreviousIndex(lightboxIndex, images.length));
  }, [images.length, lightboxIndex, selectLightboxImage]);

  const showNextInLightbox = useCallback(() => {
    selectLightboxImage(getNextIndex(lightboxIndex, images.length));
  }, [images.length, lightboxIndex, selectLightboxImage]);

  useEffect(() => {
    if (!isLightboxOpen) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      scrollTrackToIndex(lightboxTrackRef.current, initialLightboxIndexRef.current, "auto");
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isLightboxOpen]);

  useEffect(() => {
    if (!isLightboxOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        showPreviousInLightbox();
      }

      if (event.key === "ArrowRight") {
        showNextInLightbox();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLightboxOpen, showNextInLightbox, showPreviousInLightbox]);

  const openLightbox = () => {
    initialLightboxIndexRef.current = activeIndex;
    setLightboxIndex(activeIndex);
    setIsLightboxOpen(true);
  };

  const handleMainScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMultipleImages) return;

    const nextIndex = getScrollIndex(event.currentTarget, images.length);
    const targetIndex = mainScrollTargetIndexRef.current;

    if (targetIndex !== null && nextIndex !== targetIndex) {
      return;
    }

    mainScrollTargetIndexRef.current = null;

    setActiveIndex((index) => (index === nextIndex ? index : nextIndex));
  };

  const handleLightboxScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMultipleImages) return;

    const nextIndex = getScrollIndex(event.currentTarget, images.length);
    const targetIndex = lightboxScrollTargetIndexRef.current;

    if (targetIndex !== null && nextIndex !== targetIndex) {
      return;
    }

    lightboxScrollTargetIndexRef.current = null;

    setLightboxIndex((index) => (index === nextIndex ? index : nextIndex));
  };

  const clearMainScrollTarget = () => {
    mainScrollTargetIndexRef.current = null;
  };

  const clearLightboxScrollTarget = () => {
    lightboxScrollTargetIndexRef.current = null;
  };

  const handlePreviousClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    showPrevious();
  };

  const handleNextClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    showNext();
  };

  if (!activeImage || !lightboxImage) {
    return null;
  }

  return (
    <div className="flex gap-3 md:gap-4">
      {hasMultipleImages && (
        <div className="hidden w-18 shrink-0 flex-col gap-3 md:flex">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              aria-label={`Показать фото ${index + 1}`}
              aria-pressed={activeIndex === index}
              onClick={() => selectMainImage(index)}
              className={cn(
                "relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted transition",
                activeIndex === index
                  ? "border-foreground opacity-100"
                  : "border-border opacity-70 hover:opacity-100",
              )}
            >
              <Image
                fill
                src={image}
                alt=""
                unoptimized={shouldBypassNextImageOptimization(image)}
                sizes="72px"
                className="object-cover"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-3">
        <AspectRatio
          ratio={3 / 4}
          className="group/gallery relative overflow-hidden rounded-xl bg-muted"
        >
          <div
            ref={mainTrackRef}
            onScroll={handleMainScroll}
            onPointerDown={clearMainScrollTarget}
            className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                aria-label={`Открыть фото ${index + 1} в галерее`}
                onClick={openLightbox}
                className="relative h-full w-full flex-none cursor-zoom-in snap-center"
              >
                <Image
                  fill
                  src={image}
                  alt={`${title}, фото ${index + 1}`}
                  unoptimized={shouldBypassNextImageOptimization(image)}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : undefined}
                  sizes="(min-width: 1024px) 48vw, 100vw"
                  className="object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="icon-lg"
            aria-label="Открыть галерею"
            onClick={openLightbox}
            className="absolute top-3 right-3 bg-background/85 shadow-sm backdrop-blur"
          >
            <Expand />
          </Button>

          {hasMultipleImages && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon-lg"
                aria-label="Предыдущее фото"
                onClick={handlePreviousClick}
                className="absolute top-[calc(50%-1.125rem)] left-3 bg-background/85 opacity-0 shadow-sm backdrop-blur transition-opacity group-focus-within/gallery:opacity-100 group-hover/gallery:opacity-100 active:not-aria-[haspopup]:translate-y-0"
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-lg"
                aria-label="Следующее фото"
                onClick={handleNextClick}
                className="absolute top-[calc(50%-1.125rem)] right-3 bg-background/85 opacity-0 shadow-sm backdrop-blur transition-opacity group-focus-within/gallery:opacity-100 group-hover/gallery:opacity-100 active:not-aria-[haspopup]:translate-y-0"
              >
                <ChevronRight />
              </Button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                {activeIndex + 1} / {images.length}
              </div>
            </>
          )}
        </AspectRatio>

        {hasMultipleImages && (
          <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
            {images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                aria-label={`Показать фото ${index + 1}`}
                aria-pressed={activeIndex === index}
                onClick={() => selectMainImage(index)}
                className={cn(
                  "relative h-20 w-15 shrink-0 overflow-hidden rounded-lg border bg-muted transition",
                  activeIndex === index ? "border-foreground" : "border-border opacity-70",
                )}
              >
                <Image
                  fill
                  src={image}
                  alt=""
                  unoptimized={shouldBypassNextImageOptimization(image)}
                  sizes="60px"
                  className="object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent
          showCloseButton={false}
          className="h-dvh max-w-screen gap-0 overflow-hidden rounded-none border-0 bg-black/55 p-0 text-white ring-0 backdrop-blur-md sm:max-w-screen"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>

          <div className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between px-4">
            <span className="rounded-full bg-black/30 px-2.5 py-1 text-sm text-white/80 backdrop-blur">
              {lightboxIndex + 1} / {images.length}
            </span>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Закрыть галерею"
                className="bg-black/30 text-white backdrop-blur hover:bg-black/45 hover:text-white"
              >
                <X />
              </Button>
            </DialogClose>
          </div>

          <div
            ref={lightboxTrackRef}
            onScroll={handleLightboxScroll}
            onPointerDown={clearLightboxScrollTarget}
            className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((image, index) => (
              <div
                key={`${image}-${index}`}
                className="flex h-full w-full flex-none snap-center items-center justify-center px-4 py-16"
              >
                <div className="relative aspect-[3/4] w-[min(78vw,calc((100dvh-12rem)*0.75),42rem)] overflow-hidden rounded-xl bg-black/20 shadow-2xl ring-1 ring-white/15 max-md:w-[min(92vw,calc((100dvh-11rem)*0.75))]">
                  <Image
                    fill
                    src={image}
                    alt={`${title}, фото ${index + 1}`}
                    unoptimized={shouldBypassNextImageOptimization(image)}
                    sizes="(min-width: 768px) 42rem, 92vw"
                    className="object-cover"
                    draggable={false}
                  />
                </div>
              </div>
            ))}
          </div>

          {hasMultipleImages && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Предыдущее фото"
                onClick={showPreviousInLightbox}
                className="absolute top-[calc(50%-1.125rem)] left-4 bg-black/35 text-white backdrop-blur hover:bg-black/50 hover:text-white active:not-aria-[haspopup]:translate-y-0"
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Следующее фото"
                onClick={showNextInLightbox}
                className="absolute top-[calc(50%-1.125rem)] right-4 bg-black/35 text-white backdrop-blur hover:bg-black/50 hover:text-white active:not-aria-[haspopup]:translate-y-0"
              >
                <ChevronRight />
              </Button>
            </>
          )}

          {hasMultipleImages && (
            <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-4">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  aria-label={`Открыть фото ${index + 1}`}
                  aria-pressed={lightboxIndex === index}
                  onClick={() => selectLightboxImage(index)}
                  className={cn(
                    "relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border transition",
                    lightboxIndex === index
                      ? "border-white opacity-100"
                      : "border-white/20 opacity-60 hover:opacity-100",
                  )}
                >
                  <Image
                    fill
                    src={image}
                    alt=""
                    unoptimized={shouldBypassNextImageOptimization(image)}
                    sizes="48px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
