import { Badge, cn } from "@/shared";
import type { ReviewStats } from "../model";
import { RatingStars } from "./rating-stars";

export function ReviewRatingSummary({
  stats,
  className,
}: {
  stats: ReviewStats;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3 text-sm", className)}>
      <RatingStars rating={stats.rating} />
      <div className="flex flex-wrap items-center justify-center gap-2 text-stone-400">
        <Badge variant="secondary" className="bg-amber-50 text-stone-700">
          {stats.ratingLabel}&nbsp;из&nbsp;5
        </Badge>
        <span aria-hidden="true">·</span>
        <span>{stats.reviewsLabel}</span>
      </div>
    </div>
  );
}
