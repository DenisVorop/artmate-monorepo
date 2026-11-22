import type { MouseEventHandler, ReactNode } from "react";

import { Button } from "@/shared/ui";

import { getCommunityCollectionTitle } from "../lib/selectors";
import type { CommunityWorkSummary, GalleryWork } from "../model/types";
import { PublicAssetImage } from "./public-asset-image";

export function CommunityWorkImageCard({
  work,
  onOpenImage,
  priority = false,
  imageSizes = "(max-width: 767px) 50vw, 33vw",
  onPreviewIntent,
  likeAction,
}: {
  work: CommunityWorkSummary | GalleryWork;
  onOpenImage: MouseEventHandler<HTMLButtonElement>;
  priority?: boolean;
  imageSizes?: string;
  onPreviewIntent?: () => void;
  likeAction?: ReactNode;
}) {
  const title = "official" in work ? work.official.coloring.title : work.title;
  const albumTitle = "official" in work ? work.official.collection.title : work.album.title;
  return (
    <div className="group relative h-full w-full overflow-hidden rounded-2xl bg-stone-100">
      <Button
        type="button"
        variant="ghost"
        onClick={onOpenImage}
        onPointerEnter={onPreviewIntent}
        onFocus={onPreviewIntent}
        onPointerDown={onPreviewIntent}
        aria-label={`Открыть работу «${title}» автора ${work.author.name}`}
        className="absolute inset-0 block h-full w-full rounded-2xl p-0 focus-visible:ring-rose-400 focus-visible:ring-inset"
      >
        <PublicAssetImage
          key={work.publicId}
          src={work.submission.assets.web}
          sizes={imageSizes}
          alt={`Работа ${work.author.name}: ${title}`}
          priority={priority}
          className="object-contain"
        />
      </Button>
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex min-w-0 flex-col gap-1 bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-14 pl-3 text-white sm:pl-4 ${likeAction ? "pr-1 pb-4 md:pr-4 md:pb-5" : "pr-3 pb-3 sm:pr-4 sm:pb-4"}`}
      >
        <span
          className={`min-w-0 truncate text-xs leading-snug font-bold sm:text-sm lg:text-base ${likeAction ? "pr-2 sm:pr-3 md:pr-0" : ""}`}
        >
          {title}
        </span>
        <div
          className={`grid min-w-0 items-center gap-2 ${likeAction ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1"}`}
        >
          <span className="truncate text-[10px] leading-5 text-white/90 sm:text-xs">
            {work.author.name} · {getCommunityCollectionTitle(albumTitle)}
          </span>
          {/* Keep the 44px target around the 20px caption row. */}
          {likeAction && <div className="pointer-events-auto -my-3 flex">{likeAction}</div>}
        </div>
      </div>
    </div>
  );
}
