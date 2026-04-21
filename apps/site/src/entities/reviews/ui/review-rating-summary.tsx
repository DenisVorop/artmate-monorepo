import { Badge, cn } from "@/shared";
import { REVIEW_STATS } from "../model";
import { RatingStars } from "./rating-stars";

export function ReviewRatingSummary({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3 text-sm", className)}>
      <RatingStars rating={REVIEW_STATS.rating} />
      <div className="flex flex-wrap items-center justify-center gap-2 text-stone-400">
        <Badge variant="secondary" className="bg-amber-50 text-stone-700">
          {REVIEW_STATS.ratingLabel} из 5
        </Badge>
        <span aria-hidden="true">·</span>
        <span>{REVIEW_STATS.reviewsLabel}</span>
      </div>
    </div>
  );
}
