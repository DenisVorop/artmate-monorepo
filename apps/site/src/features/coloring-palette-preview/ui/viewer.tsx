"use client";

import { ChevronsLeftRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/shared/lib/utils";
import { Button, Slider } from "@/shared/ui";

type ViewerProps = {
  left: string;
  right: string;
  leftLabel: string;
  rightLabel: string;
  label: string;
  split: number;
  setSplit: (_value: number) => void;
};

export function Viewer({
  left,
  right,
  leftLabel,
  rightLabel,
  label,
  split,
  setSplit,
}: ViewerProps) {
  const [failedSource, setFailedSource] = useState<string>();
  const hasError = failedSource === left || failedSource === right;

  return (
    <section
      id="palette-viewer"
      className="mx-auto w-full space-y-4 md:max-w-[min(100%,calc((100dvh-8rem)*538/760))]"
      aria-label={label}
    >
      <div className="relative isolate aspect-[538/760] rounded-2xl bg-stone-100 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.45)] ring-1 ring-stone-900/10">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <Image
            src={right}
            alt={`Корги среди тюльпанов — ${rightLabel}`}
            fill
            unoptimized
            priority
            draggable={false}
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-contain"
            onError={() => setFailedSource(right)}
          />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
            <Image
              src={left}
              alt={`Корги среди тюльпанов — ${leftLabel}`}
              fill
              unoptimized
              priority
              draggable={false}
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-contain"
              onError={() => setFailedSource(left)}
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_5px_#0005]"
            style={{ left: `${split}%` }}
          />
          {hasError && (
            <p
              role="alert"
              className="absolute inset-0 z-20 grid place-content-center bg-white/95 p-6 text-center"
            >
              Не удалось загрузить картинку. Попробуйте обновить страницу.
            </p>
          )}
        </div>
        <Slider
          value={[split]}
          onValueChange={([value]) => setSplit(value ?? 50)}
          disabled={hasError}
          min={0}
          max={100}
          step={1}
          className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-11 -translate-y-1/2"
          trackClassName="bg-transparent"
          rangeClassName="bg-transparent"
          thumbClassName="pointer-events-auto size-px cursor-ew-resize border-0 bg-transparent shadow-none after:absolute after:-inset-[21.5px] after:rounded-full after:border-4 after:border-white after:bg-rose-500 after:shadow-md"
          thumbProps={{
            "aria-label": `${label} — ползунок на картинке`,
            "aria-valuetext": `${leftLabel}: ${split}%, ${rightLabel}: ${100 - split}%`,
            children: (
              <ChevronsLeftRight
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 z-10 size-5 -translate-x-1/2 -translate-y-1/2 text-white"
              />
            ),
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          className={cn("min-h-11", split === 0 && "border-rose-400")}
          onClick={() => setSplit(0)}
          disabled={hasError}
        >
          {rightLabel}
        </Button>
        <Button
          variant="outline"
          className={cn("min-h-11", split === 100 && "border-rose-400")}
          onClick={() => setSplit(100)}
          disabled={hasError}
        >
          {leftLabel}
        </Button>
      </div>
      <Slider
        value={[split]}
        onValueChange={([value]) => setSplit(value ?? 50)}
        disabled={hasError}
        min={0}
        max={100}
        step={1}
        className="h-11"
        trackClassName="bg-stone-200"
        rangeClassName="bg-rose-500"
        thumbClassName="size-6 border-white bg-rose-500"
        thumbProps={{
          "aria-label": label,
          "aria-valuetext": `${leftLabel}: ${split}%, ${rightLabel}: ${100 - split}%`,
        }}
      />
    </section>
  );
}
