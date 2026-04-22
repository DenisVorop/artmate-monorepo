import { Star } from "lucide-react";

import { cn } from "@/shared";

export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn("flex gap-0.5", className)} aria-label={`${rating} из\u00a05`}>
      {Array.from({ length: 5 }, (_, index) => {
        const isFilled = index < rating;

        return (
          <Star
            key={index}
            className={cn(
              "h-3.5 w-3.5",
              isFilled ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200",
            )}
          />
        );
      })}
    </div>
  );
}
