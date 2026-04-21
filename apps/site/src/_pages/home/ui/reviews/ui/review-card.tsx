import { Quote } from "lucide-react";

import { RatingStars, type Review } from "@/entities/reviews";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

type ReviewCardProps = {
  review: Review;
};

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <Card
      role="article"
      className="h-full gap-0 border border-stone-100 bg-stone-50 py-0 shadow-sm ring-0 shadow-stone-200/50"
    >
      <CardHeader className="px-5 pt-5">
        <Quote className="h-5 w-5 shrink-0 text-rose-300" aria-hidden="true" />
        <CardAction>
          <RatingStars rating={review.rating} />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 px-5 py-4">
        <CardDescription className="text-sm leading-relaxed text-stone-600">
          «{review.text}»
        </CardDescription>
      </CardContent>

      <CardFooter className="mt-auto flex-col items-start border-stone-200 bg-transparent px-5 py-3">
        <CardTitle className="text-sm font-semibold text-stone-800">{review.name}</CardTitle>
        <CardDescription className="mt-0.5 text-xs leading-snug text-stone-400">
          {review.product}
        </CardDescription>
      </CardFooter>
    </Card>
  );
}
