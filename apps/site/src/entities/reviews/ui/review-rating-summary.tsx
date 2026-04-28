import { Badge } from "@/shared/ui";
import { cn } from "@/shared/lib";
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
    <div className={cn("flex flex-wrap items-center justify-center gap-2 text-sm", className)}>
      <div className="flex shrink-0 items-center gap-2">
        <RatingStars rating={stats.rating} />
        <Badge variant="secondary" className="bg-amber-50 text-stone-700">
          {stats.ratingLabel}&nbsp;из&nbsp;5
        </Badge>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-stone-400">
        <span aria-hidden="true" className="hidden sm:inline">
          ·
        </span>
        <span>{stats.reviewsLabel}</span>
      </div>
    </div>
  );
}
