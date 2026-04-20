import { reviewAvatars } from "../constants";
import { Badge } from "@/shared";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/shared/ui/avatar";
import { Star } from "lucide-react";

export function Reviews() {
  return (
    <div className="flex flex-wrap items-center gap-6">
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

      <div className="flex items-center gap-1.5">
        <div className="flex">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
          ))}
        </div>
        <Badge variant="secondary" className="bg-amber-50">
          4.9
        </Badge>
        <span className="text-sm text-stone-400">· 4 500+ отзывов на Ozon и Wildberries</span>
      </div>
    </div>
  );
}
