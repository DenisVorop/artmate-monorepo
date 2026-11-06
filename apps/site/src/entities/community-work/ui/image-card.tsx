import type { MouseEventHandler, ReactNode } from "react";

import { Button } from "@/shared/ui";

import { getCommunityCollectionTitle } from "../lib/selectors";
import type { CommunityWorkSummary } from "../model/types";
import { PublicAssetImage } from "./public-asset-image";

export function CommunityWorkImageCard({
  work,
  onOpenImage,
  priority = false,
  imageSizes = "(max-width: 767px) 50vw, 33vw",
  onPreviewIntent,
  likeAction,
}: {
  work: CommunityWorkSummary;
  onOpenImage: MouseEventHandler<HTMLButtonElement>;
  priority?: boolean;
  imageSizes?: string;
  onPreviewIntent?: () => void;
  likeAction?: ReactNode;
}) {
  return (
    <div className="group relative h-full w-full overflow-hidden rounded-2xl bg-stone-100">
      <Button
        type="button"
        variant="ghost"
        onClick={onOpenImage}
        onPointerEnter={onPreviewIntent}
        onFocus={onPreviewIntent}
        onPointerDown={onPreviewIntent}
        aria-label={`Открыть работу «${work.official.coloring.title}» автора ${work.author.name}`}
        className="absolute inset-0 block h-full w-full rounded-2xl p-0 focus-visible:ring-rose-400 focus-visible:ring-inset"
      >
        <PublicAssetImage
          key={work.revisionId}
          src={work.submission.assets.web}
          sizes={imageSizes}
          alt={`Работа ${work.author.name}: ${work.official.coloring.title}`}
          priority={priority}
          className="object-cover"
        />
      </Button>
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 grid items-end gap-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-14 pl-3 text-white sm:pl-4 ${likeAction ? "grid-cols-[minmax(0,1fr)_auto] pr-1 pb-2 sm:pb-3 md:pr-4" : "grid-cols-1 pr-3 pb-3 sm:pr-4 sm:pb-4"}`}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-xs leading-snug font-bold sm:text-sm lg:text-base">
            {work.official.coloring.title}
          </span>
          <span className="truncate text-[10px] text-white/90 sm:text-xs">
            {work.author.name} · {getCommunityCollectionTitle(work.official.collection.title)}
          </span>
        </div>
        {likeAction && <div className="pointer-events-auto flex items-end">{likeAction}</div>}
      </div>
    </div>
  );
}
