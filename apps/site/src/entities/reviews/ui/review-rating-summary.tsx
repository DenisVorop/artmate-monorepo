import { Badge, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui";
import { externalLinks } from "@/shared/constants";
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
        <span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="cursor-help rounded-sm border-0 bg-transparent p-0 text-inherit underline decoration-stone-300 decoration-dotted underline-offset-4 outline-none [font:inherit] focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {stats.reviewsLabel}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{stats.reviewsTooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>{" "}
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
