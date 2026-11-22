import { memo, type CSSProperties } from "react";

import { CommunityWorkImageCard, type GalleryWork } from "@/entities/community-work";
import { cn } from "@/shared/lib";
import { LikeButton } from "@/features/likes";

import { getMosaicBlocks, getMosaicImageSizes } from "../lib/mosaic-layout";

export const Mosaic = memo(function Mosaic({
  workPages,
  onOpenImage,
  onPreviewIntent,
}: {
  workPages: readonly (readonly GalleryWork[])[];
  onOpenImage: (_work: GalleryWork, _button: HTMLButtonElement) => void;
  onPreviewIntent?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:gap-5">
      {getMosaicBlocks(workPages).map((block, blockIndex) => (
        <ul
          key={`${block.items[0]!.source}:${block.items[0]!.publicId}`}
          className={cn(
            "grid gap-3 md:gap-5",
            block.items.length <= 3
              ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
              : "aspect-(--narrow-ratio) grid-cols-(--narrow-columns) grid-rows-[repeat(12,minmax(0,1fr))] md:aspect-(--wide-ratio) md:grid-cols-(--wide-columns)",
          )}
          data-compact={block.items.length <= 3 || undefined}
          style={
            {
              "--wide-columns": block.wide.columns,
              "--wide-ratio": block.wide.ratio,
              "--narrow-columns": block.narrow.columns,
              "--narrow-ratio": block.narrow.ratio,
            } as CSSProperties
          }
        >
          {block.items.map((work, index) => (
            <li
              key={`${work.source}:${work.publicId}`}
              className={cn(
                "min-h-0 min-w-0",
                block.items.length <= 3
                  ? "aspect-[3/4]"
                  : "[grid-column:var(--narrow-column)] [grid-row:var(--narrow-row)] md:[grid-column:var(--wide-column)] md:[grid-row:var(--wide-row)]",
              )}
              style={
                {
                  "--wide-column": block.wide.positions[index]!.column,
                  "--wide-row": block.wide.positions[index]!.row,
                  "--narrow-column": block.narrow.positions[index]!.column,
                  "--narrow-row": block.narrow.positions[index]!.row,
                } as CSSProperties
              }
            >
              <CommunityWorkImageCard
                work={work}
                priority={blockIndex === 0 && index === 0}
                imageSizes={getMosaicImageSizes(block, index)}
                onPreviewIntent={onPreviewIntent}
                onOpenImage={(event) => onOpenImage(work, event.currentTarget)}
                likeAction={
                  <LikeButton
                    subject={{
                      subjectType: work.source === "contest" ? "contest-work" : "community-work",
                      subjectId: work.publicId,
                    }}
                    title={work.source === "contest" ? work.title : work.official.coloring.title}
                  />
                }
              />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
});
