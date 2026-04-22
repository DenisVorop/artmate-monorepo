import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Card, CardContent } from "@/shared/ui/card";
import type { Review } from "../model";
import { RatingStars } from "./rating-stars";

type ReviewListProps = {
  reviews: Review[];
};

export function ReviewList({ reviews }: ReviewListProps) {
  return (
    <div className="grid gap-3">
      {reviews.map((review) => (
        <Card key={review.id} size="sm" className="bg-muted/30">
          <CardContent className="flex gap-3">
            <Avatar className="size-9">
              <AvatarFallback>{review.name.slice(0, 1)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-medium text-foreground">{review.name}</p>
                <RatingStars rating={review.rating} />
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{review.text}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
