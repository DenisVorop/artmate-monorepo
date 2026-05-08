"use client";

import * as React from "react";
import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui";
import { externalLinks } from "@/shared/constants";
import { useIsMobile } from "@/shared/lib/device";
import { cn } from "@/shared/lib";
import type { ReviewStats } from "../model";
import { RatingStars } from "./rating-stars";

const reviewsLabelTriggerClassName =
  "cursor-help rounded-sm border-0 bg-transparent p-0 text-inherit underline decoration-stone-300 decoration-dotted underline-offset-4 outline-none [font:inherit] focus-visible:ring-2 focus-visible:ring-ring/50";

function MobileReviewsTooltip({ stats }: { stats: ReviewStats }) {
  const tooltipId = React.useId();
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        className={reviewsLabelTriggerClassName}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        {stats.reviewsLabel}
      </button>
      {isOpen && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg bg-popover px-3 py-2 text-left text-xs leading-5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {stats.reviewsTooltip}
          <span className="absolute top-full left-6 -z-10 size-2 -translate-y-[3px] rotate-45 border-r border-b border-foreground/10 bg-popover" />
        </span>
      )}
    </span>
  );
}

function ReviewsLabelInfo({ stats }: { stats: ReviewStats }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileReviewsTooltip stats={stats} />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={reviewsLabelTriggerClassName}>
            {stats.reviewsLabel}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{stats.reviewsTooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ReviewRatingSummary({
  stats,
  className,
}: {
  stats: ReviewStats;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2 text-sm", className)}>
      <div className="flex shrink-0 items-center gap-2">
        <RatingStars rating={stats.rating} />
        <Badge variant="secondary" className="bg-amber-50 text-stone-700">
          {stats.ratingLabel}&nbsp;из&nbsp;5
        </Badge>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-stone-400">
        <span>
          <ReviewsLabelInfo stats={stats} />{" "}
          на{" "}
          <a
            href={externalLinks.marketplaces.ozon}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Ozon
          </a>{" "}
          и{" "}
          <a
            href={externalLinks.marketplaces.wildberries}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Wildberries
          </a>
        </span>
      </div>
    </div>
  );
}
