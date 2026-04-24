"use client";

import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState, type MouseEvent } from "react";

import { AspectRatio, Button, Dialog, DialogClose, DialogContent, DialogTitle } from "@/shared/ui";
import { cn } from "@/shared/lib";

type GalleryProps = {
  images: string[];
  title: string;
};

export function Gallery({ images, title }: GalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const hasMultipleImages = images.length > 1;
  const activeImage = images[activeIndex];
  const lightboxImage = images[lightboxIndex] ?? activeImage;

  const showPrevious = useCallback(() => {
    setActiveIndex((index) => (index - 1 + images.length) % images.length);
  }, [images.length]);

  const showNext = useCallback(() => {
    setActiveIndex((index) => (index + 1) % images.length);
  }, [images.length]);

  const showPreviousInLightbox = useCallback(() => {
    setLightboxIndex((index) => (index - 1 + images.length) % images.length);
  }, [images.length]);

  const showNextInLightbox = useCallback(() => {
    setLightboxIndex((index) => (index + 1) % images.length);
  }, [images.length]);

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

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, showNextInLightbox, showPreviousInLightbox]);

  const openLightbox = () => {
    setLightboxIndex(activeIndex);
    setIsLightboxOpen(true);
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
              key={image}
              type="button"
              aria-label={`Показать фото ${index + 1}`}
              aria-pressed={activeIndex === index}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg border bg-muted transition",
                activeIndex === index
                  ? "border-foreground opacity-100"
                  : "border-border opacity-70 hover:opacity-100",
              )}
            >
              <Image
                fill
                src={image}
                alt=""
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
          ratio={1}
          className="group/gallery relative overflow-hidden rounded-xl bg-muted"
        >
          <button
            type="button"
            aria-label="Открыть галерею"
            onClick={openLightbox}
            className="absolute inset-0 cursor-zoom-in"
          >
            <Image
              fill
              src={activeImage}
              alt={`${title}, фото ${activeIndex + 1}`}
              loading={activeIndex === 0 ? "eager" : "lazy"}
              fetchPriority={activeIndex === 0 ? "high" : undefined}
              sizes="(min-width: 1024px) 48vw, 100vw"
              className="object-cover"
              draggable={false}
            />
          </button>

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
                key={image}
                type="button"
                aria-label={`Показать фото ${index + 1}`}
                aria-pressed={activeIndex === index}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted transition",
                  activeIndex === index ? "border-foreground" : "border-border opacity-70",
                )}
              >
                <Image
                  fill
                  src={image}
                  alt=""
                  sizes="64px"
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

          <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-16">
            <div className="relative aspect-square w-[min(78vw,calc(100dvh-12rem))] max-w-[42rem] overflow-hidden rounded-xl bg-black/20 shadow-2xl ring-1 ring-white/15 max-md:w-[min(92vw,calc(100dvh-11rem))]">
              <Image
                fill
                src={lightboxImage}
                alt={`${title}, фото ${lightboxIndex + 1}`}
                sizes="(min-width: 768px) min(78vw, 42rem), 92vw"
                className="object-cover"
                draggable={false}
              />
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
          </div>

          {hasMultipleImages && (
            <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-4">
              {images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  aria-label={`Открыть фото ${index + 1}`}
                  aria-pressed={lightboxIndex === index}
                  onClick={() => setLightboxIndex(index)}
                  className={cn(
                    "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition",
                    lightboxIndex === index
                      ? "border-white opacity-100"
                      : "border-white/20 opacity-60 hover:opacity-100",
                  )}
                >
                  <Image fill src={image} alt="" sizes="56px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
