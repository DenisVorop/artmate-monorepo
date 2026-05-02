import { ReviewRatingSummary } from "@/entities/reviews";
import { reviewsData } from "@/shared/actions/reviews/reviews.data";
import { cn } from "@/shared/lib";
import { SectionLabel, SectionTitle } from "@/shared/ui/typography";
import { ReviewsRail } from "./ui/reviews-rail";

type ReviewsProps = {
  className?: string;
};

export function Reviews({ className }: ReviewsProps) {
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

        <ReviewsRail reviews={reviewsData.reviews} />

        <ReviewRatingSummary stats={reviewsData.stats} className="mt-6" />
      </div>
    </section>
  );
}
