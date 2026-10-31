import type { CSSProperties } from "react";

import { CommunityWorkImageCard, type CommunityWorkSummary } from "@/entities/community-work";

import { getMosaicBlocks } from "../lib/mosaic-layout";
import styles from "./mosaic.module.css";

export function Mosaic({
  works,
  onOpenImage,
}: {
  works: readonly CommunityWorkSummary[];
  onOpenImage: (_work: CommunityWorkSummary, _button: HTMLButtonElement) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:gap-5">
      {getMosaicBlocks(works).map((block, blockIndex) => (
        <ul
          key={block.items[0]!.publicId}
          className={styles.block}
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
              key={work.publicId}
              className={styles.tile}
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
                onOpenImage={(event) => onOpenImage(work, event.currentTarget)}
              />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
