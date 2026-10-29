import { ReviewRatingSummary } from "@/entities/reviews";
import { reviewsData } from "@/shared/actions/reviews/reviews.data";
import { SectionTitle } from "@/shared/ui/typography";
import { ReviewsRail } from "./ui/reviews-rail";

type ReviewsProps = {
  className?: string;
};

export function Reviews({ className }: ReviewsProps) {
  return (
    <section aria-labelledby="reviews-title" className={className}>
      <div className="container">
        <div className="mb-8">
          <SectionTitle id="reviews-title">Что говорят наши покупатели</SectionTitle>
        </div>

        <ReviewsRail reviews={reviewsData.reviews} />

        <ReviewRatingSummary stats={reviewsData.stats} className="mt-6" />
      </div>
    </section>
  );
}
