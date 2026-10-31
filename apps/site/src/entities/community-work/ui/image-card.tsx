import type { MouseEventHandler } from "react";

import { Button } from "@/shared/ui";

import { getCommunityCollectionTitle } from "../lib/selectors";
import type { CommunityWorkSummary } from "../model/types";
import { PublicAssetImage } from "./public-asset-image";

export function CommunityWorkImageCard({
  work,
  onOpenImage,
  priority = false,
}: {
  work: CommunityWorkSummary;
  onOpenImage: MouseEventHandler<HTMLButtonElement>;
  priority?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onOpenImage}
      aria-label={`Открыть работу «${work.official.coloring.title}» автора ${work.author.name}`}
      className="group relative block h-full w-full overflow-hidden rounded-2xl bg-stone-100 p-0 text-left font-normal whitespace-normal focus-visible:ring-rose-400"
    >
      <PublicAssetImage
        key={work.revisionId}
        src={work.submission.assets.web}
        alt={`Работа ${work.author.name}: ${work.official.coloring.title}`}
        priority={priority}
        className="object-cover"
      />
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pt-14 pb-3 text-white sm:px-4 sm:pb-4">
        <span className="line-clamp-2 text-xs leading-snug font-bold sm:text-sm lg:text-base">
          {work.official.coloring.title}
        </span>
        <span className="line-clamp-1 text-[10px] text-white/90 sm:text-xs">
          {work.author.name} · {getCommunityCollectionTitle(work.official.collection.title)}
        </span>
      </span>
    </Button>
  );
}
