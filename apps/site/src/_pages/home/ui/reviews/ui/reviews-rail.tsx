"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Review } from "@/entities/reviews";
import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { MoreReviewsCard } from "./more-reviews-card";
import { ReviewCard } from "./review-card";

type ReviewsRailProps = {
  reviews: Review[];
};

type ScrollState = {
  canScrollPrev: boolean;
  canScrollNext: boolean;
};

const INITIAL_SCROLL_STATE: ScrollState = {
  canScrollPrev: false,
  canScrollNext: false,
};

export function ReviewsRail({ reviews }: ReviewsRailProps) {
  const railId = React.useId();
  const railRef = React.useRef<HTMLUListElement>(null);
  const [scrollState, setScrollState] = React.useState(INITIAL_SCROLL_STATE);

  const updateScrollState = React.useCallback(() => {
    const rail = railRef.current;

    if (!rail) return;

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    const nextState = {
      canScrollPrev: rail.scrollLeft > 1,
      canScrollNext: rail.scrollLeft < maxScrollLeft - 1,
    };

    setScrollState((currentState) =>
      currentState.canScrollPrev === nextState.canScrollPrev &&
      currentState.canScrollNext === nextState.canScrollNext
        ? currentState
        : nextState,
    );
  }, []);

  React.useEffect(() => {
    const rail = railRef.current;

    if (!rail) return;

    updateScrollState();

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(rail);

    rail.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      resizeObserver.disconnect();
      rail.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState]);

  const scrollByCard = (direction: -1 | 1) => {
    const rail = railRef.current;

    if (!rail) return;

    const firstCard = rail.querySelector<HTMLElement>("[data-review-card]");
    const styles = getComputedStyle(rail);
    const parsedGap = Number.parseFloat(styles.columnGap);
    const gap = Number.isFinite(parsedGap) ? parsedGap : 16;
    const distance = (firstCard?.offsetWidth ?? rail.clientWidth * 0.85) + gap;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    rail.scrollBy({
      left: direction * distance,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-controls={railId}
          aria-label="Прокрутить отзывы влево"
          disabled={!scrollState.canScrollPrev}
          onClick={() => scrollByCard(-1)}
          className="border-stone-200 bg-white text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-controls={railId}
          aria-label="Прокрутить отзывы вправо"
          disabled={!scrollState.canScrollNext}
          onClick={() => scrollByCard(1)}
          className="border-stone-200 bg-white text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
        >
          <ChevronRight />
        </Button>
      </div>

      <ul
        ref={railRef}
        id={railId}
        aria-label="Лента отзывов покупателей"
        className={cn(
          "relative right-[50%] left-[50%] -mr-[50vw] -ml-[50vw] flex w-screen snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 pb-2",
          "sm:right-auto sm:left-auto sm:mr-0 sm:ml-0 sm:w-auto sm:scroll-px-0 sm:px-0",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {reviews.map((review) => (
          <li
            key={review.id}
            data-review-card
            className="w-[calc(100vw-2rem)] shrink-0 snap-start sm:w-[22rem] md:w-[24rem] lg:w-[26rem]"
          >
            <ReviewCard review={review} />
          </li>
        ))}

        <li
          data-review-card
          className="w-[calc(100vw-2rem)] shrink-0 snap-start sm:w-[22rem] md:w-[24rem] lg:w-[26rem]"
        >
          <MoreReviewsCard />
        </li>
      </ul>
    </div>
  );
}
