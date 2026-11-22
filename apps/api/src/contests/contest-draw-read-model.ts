import { Prisma } from "../generated/prisma/client";
import {
  contestEntryInclude,
  mapContestWork,
} from "./contest-entry-read-model";

export const contestDrawInclude = {
  actor: { select: { id: true, name: true } },
  winners: {
    orderBy: { entryId: "asc" as const },
    include: {
      entry: {
        include: {
          ...contestEntryInclude,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ContestDrawInclude;
export type ContestDrawRecord = Prisma.ContestDrawGetPayload<{
  include: typeof contestDrawInclude;
}>;

export function mapContestDraw(draw: ContestDrawRecord | null, admin = false) {
  if (!draw) return null;
  return {
    mode: draw.mode,
    drawnAt: draw.createdAt.toISOString(),
    eligibleCount: draw.eligibleCount,
    requestedWinners: draw.requestedWinners,
    winners: draw.winners.map((winner) => {
      const entry = winner.entry;
      const visible =
        entry.status === "APPROVED" &&
        entry.publishedAt &&
        (!entry.publicationEndsAt || entry.publicationEndsAt > new Date()) &&
        entry.user.status === "ACTIVE" &&
        !entry.user.deletedAt;
      return {
        id: winner.id,
        work: visible ? mapContestWork(entry) : null,
        ...(admin
          ? {
              entryId: entry.id,
              author: entry.user.name?.trim() || "Автор",
              entryVersion: winner.entryVersion,
              revision: winner.revision,
            }
          : {}),
      };
    }),
    ...(admin
      ? {
          id: draw.id,
          actor: draw.actor,
          eligibilityHash: draw.eligibilityHash,
          algorithm: draw.algorithm,
          eligibility: draw.eligibility,
          selectionOrder: draw.selectionOrder,
        }
      : {}),
  };
}
