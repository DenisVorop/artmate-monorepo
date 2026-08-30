"use client";

import { ChevronsLeftRight } from "lucide-react";
import type { KeyboardEvent } from "react";

import { cn } from "@/shared/lib";
import { Slider } from "@/shared/ui";

import {
  clampOutlinePercent,
  getComparisonKeyboardValue,
  getComparisonValueText,
  isComparisonAdjustmentKey,
} from "../lib/comparison-state";

type ComparisonSliderProps = {
  disabled: boolean;
  onValueChange: (_value: number) => void;
  onValueCommit: (_value: number) => void;
  placement: "image" | "below";
  value: number;
};

export function ComparisonSlider({
  disabled,
  onValueChange,
  onValueCommit,
  placement,
  value,
}: ComparisonSliderProps) {
  const isOverlay = placement === "image";
  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const nextValue = getComparisonKeyboardValue(event.key, value);

    if (nextValue !== undefined) {
      event.preventDefault();
      onValueChange(nextValue);
    }
  };
  const handleKeyUp = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (isComparisonAdjustmentKey(event.key)) {
      onValueCommit(value);
    }
  };

  return (
    <Slider
      data-comparison-control={placement}
      min={0}
      max={100}
      step={0.01}
      value={[value]}
      disabled={disabled}
      onValueChange={([nextValue]) => {
        if (nextValue !== undefined) {
          onValueChange(clampOutlinePercent(nextValue));
        }
      }}
      onValueCommit={([nextValue]) => {
        if (nextValue !== undefined) {
          onValueCommit(clampOutlinePercent(nextValue));
        }
      }}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className={cn(
        "h-11 overflow-visible",
        isOverlay && "pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2",
      )}
      trackClassName={cn("data-horizontal:h-2", isOverlay ? "bg-transparent" : "bg-stone-200")}
      rangeClassName={isOverlay ? "bg-transparent" : "bg-rose-500"}
      // A 1px layout thumb keeps the divider aligned 1:1; ::after supplies the 44px touch target.
      thumbClassName="pointer-events-auto z-10 size-px cursor-ew-resize border-0 bg-transparent shadow-none ring-0 after:pointer-events-auto after:absolute after:-inset-[21.5px] after:box-border after:rounded-full after:border-4 after:border-white after:bg-rose-500 after:shadow-md after:content-[''] hover:ring-0 hover:after:bg-rose-600 focus-visible:ring-0 focus-visible:after:ring-4 focus-visible:after:ring-inset focus-visible:after:ring-rose-300/70 active:ring-0 active:after:bg-rose-600 data-disabled:pointer-events-none data-disabled:after:pointer-events-none data-disabled:after:bg-rose-300 data-disabled:after:opacity-50"
      thumbProps={{
        "aria-label": isOverlay
          ? "Сравнить контур и цветную версию на изображении"
          : "Соотношение контура и цветной версии",
        "aria-valuetext": getComparisonValueText(value),
        children: (
          <ChevronsLeftRight
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 z-10 size-5 -translate-x-1/2 -translate-y-1/2 text-white"
          />
        ),
      }}
    />
  );
}
