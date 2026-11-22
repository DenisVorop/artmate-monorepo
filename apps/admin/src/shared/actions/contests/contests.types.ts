import type { ContestAppearance } from "@repo/ui/contest-design";
export type ContestStage =
  | "draft"
  | "upcoming"
  | "open"
  | "review"
  | "completed";
export type ContestSelectionMode = "AUTOMATIC" | "MANUAL";
export type PromoPrizeTerms = {
  name: string;
  type: "PERCENTAGE" | "FIXED";
  basisPoints: number | null;
  amountKopecks: number | null;
  minSubtotalKopecks: number;
  maxDiscountKopecks: number | null;
  startsAt: string | null;
  endsAt: string | null;
};
export type ContestPlacePrizeInput = {
  prize: string;
  prizeDetail: string;
  prizeAlbumQuantity: number | null;
  prizeAlbumIds: string[];
  prizeMarkerQuantity: number | null;
  prizeMarkerIds: string[];
  prizePromoCodeId: string | null;
};
export type ContestInput = {
  prizeMode: "EQUAL" | "PLACES";
  prizePlaces: ContestPlacePrizeInput[];
  prizeMarkerQuantity: number | null;
  prizeMarkerIds: string[];
  participationPromoCodeId: string | null;
  title: string;
  slug: string;
  description: string;
  task: string;
  rules: string[];
  appearance: ContestAppearance;
  prize: string;
  prizeDetail: string;
  prizeAlbumQuantity: number | null;
  prizeAlbumIds: string[];
  prizePromoCodeId: string | null;
  winnersCount: number;
  selectionMode: ContestSelectionMode;
  manualCriteria: string;
  manualTieBreak: string;
  manualEvaluator: string;
  opensAt: string;
  closesAt: string;
  drawAt: string;
  published: boolean;
};
export type Contest = Omit<ContestInput, "prizePlaces"> & {
  prizePlaces: (ContestPlacePrizeInput & {
    prizePromoTerms: PromoPrizeTerms | null;
  })[];
  participationPromoTerms: PromoPrizeTerms | null;
  id: string;
  legalHref: string | null;
  legalDocumentId: string | null;
  legalErrors: string[];
  prizePromoTerms: PromoPrizeTerms | null;
  stage: ContestStage;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  entriesCount?: number;
  pendingCount?: number;
};
export type ContestWork = {
  id: string;
  author: string;
  title: string;
  image: string;
  albumTitle: string;
};
export type ContestDrawData = {
  contest: Pick<
    Contest,
    | "id"
    | "title"
    | "slug"
    | "selectionMode"
    | "winnersCount"
    | "drawAt"
    | "prizeMode"
  > & { prizes: { place: number; title: string }[] };
  candidates: { entryId: string; version: number; work: ContestWork }[];
  pendingCount: number;
  rosterToken: string | null;
  blocker: string | null;
  result: null | {
    id: string;
    mode: ContestSelectionMode;
    drawnAt: string;
    eligibleCount: number;
    requestedWinners: number;
    actor: { id: string; name: string | null } | null;
    algorithm: string;
    eligibilityHash: string;
    winners: {
      id: string;
      entryId: string;
      author: string;
      work: ContestWork | null;
      entryVersion: number;
      revision: number;
      place?: number;
      prizeTitle?: string;
    }[];
  };
};
export type ManualContestDrawInput = {
  rosterToken: string;
  entryIds: string[];
};
