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
    <div className="group relative flex h-full w-full min-w-0 flex-col">
      <Button
        type="button"
        variant="ghost"
        onClick={onOpenImage}
        onPointerEnter={onPreviewIntent}
        onFocus={onPreviewIntent}
        onPointerDown={onPreviewIntent}
        aria-label={`Открыть работу «${work.official.coloring.title}» автора ${work.author.name}`}
        className="absolute inset-0 z-10 block h-full w-full rounded-2xl p-0 hover:bg-transparent focus-visible:ring-rose-400 focus-visible:ring-inset"
      />
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-stone-100">
        <PublicAssetImage
          key={work.revisionId}
          src={work.submission.assets.web}
          sizes={imageSizes}
          alt={`Работа ${work.author.name}: ${work.official.coloring.title}`}
          priority={priority}
          className="object-cover"
        />
        {likeAction && (
          <div className="absolute right-1.5 bottom-1.5 z-20 rounded-full bg-black/60 text-white">
            {likeAction}
          </div>
        )}
      </div>
      <div className="pointer-events-none flex h-13 min-w-0 shrink-0 flex-col gap-1 pt-2 pb-1">
        <span
          className="truncate text-sm leading-5 font-semibold text-stone-900 md:text-base"
          title={work.official.coloring.title}
        >
          {work.official.coloring.title}
        </span>
        <span className="truncate text-xs leading-4 text-stone-600">
          {work.author.name} · {getCommunityCollectionTitle(work.official.collection.title)}
        </span>
      </div>
    </div>
  );
}
