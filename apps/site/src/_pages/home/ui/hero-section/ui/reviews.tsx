import { ReviewRatingSummary, type ReviewStats } from "@/entities/reviews";

export function Reviews({ stats }: { stats?: ReviewStats }) {
  if (!stats) {
    return null;
  }

  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
      <ReviewRatingSummary stats={stats} className="justify-start" />
    </div>
  );
}
