import { reviewAvatars } from "../constants";
import { ReviewRatingSummary, type ReviewStats } from "@/entities/reviews";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/shared/ui/avatar";

export function Reviews({ stats }: { stats?: ReviewStats }) {
  if (!stats) {
    return null;
  }

  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
      <AvatarGroup className="*:data-[slot=avatar]:ring-white">
        {reviewAvatars.map((image) => (
          <Avatar key={image.alt} className="size-9 border-2 border-white ring-1 ring-stone-100">
            <AvatarImage src={image.src.src} alt={image.alt} />
            <AvatarFallback className="bg-stone-100 text-[10px] text-stone-500">AM</AvatarFallback>
          </Avatar>
        ))}
        <AvatarGroupCount className="size-9 border-2 border-white bg-rose-100 text-[9px] font-bold text-rose-500 ring-1 ring-stone-100">
          +4.5к
        </AvatarGroupCount>
      </AvatarGroup>

      <ReviewRatingSummary stats={stats} className="justify-start" />
    </div>
  );
}
