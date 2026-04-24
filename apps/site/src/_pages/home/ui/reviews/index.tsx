import { ReviewRatingSummary, type Review, type ReviewStats } from "@/entities/reviews";
import { cn } from "@/shared/lib";
import { SectionLabel, SectionTitle } from "@/shared/ui/typography";
import { ReviewsRail } from "./ui/reviews-rail";

export function Reviews({
  reviews,
  stats,
  className,
}: {
  reviews: Review[];
  stats: ReviewStats;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="reviews-title"
      className={cn("border-y border-stone-100 bg-white", className)}
    >
      <div className="container">
        <div className="mb-8">
          <SectionLabel className="mb-3" color="rose">
            Отзывы
          </SectionLabel>
          <SectionTitle id="reviews-title">Что говорят наши покупатели</SectionTitle>
        </div>

        <ReviewsRail reviews={reviews} />

        <ReviewRatingSummary stats={stats} className="mt-6" />
      </div>
    </section>
  );
}
