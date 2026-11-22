import type { ContestPrizePresentation } from "@repo/ui/contest-prizes";
import type { ContestAppearance } from "@repo/ui/contest-design";
export type ContestStage = "upcoming" | "open" | "review" | "completed";
export type ContestWork = {
  id: string;
  title: string;
  author: string;
  albumId: string;
  albumTitle: string;
  number?: number;
  image: string;
  product: { slug: string; title: string; categorySlug?: string };
};
export type Contest = {
  id: string;
  legalHref: string | null;
  legalDocumentId: string | null;
  slug: string;
  title: string;
  description: string;
  task: string;
  rules: string[];
  appearance: ContestAppearance;
  prizePresentation: ContestPrizePresentation;
  prize: string;
  prizeDetail: string;
  winnersCount: number;
  selectionMode: "AUTOMATIC" | "MANUAL";
  opensAt: string;
  closesAt: string;
  drawAt: string;
  stage: ContestStage;
  works: ContestWork[];
  resultsPendingModeration?: boolean;
  draw: null | {
    mode: "AUTOMATIC" | "MANUAL";
    drawnAt: string;
    eligibleCount: number;
    requestedWinners: number;
    winners: { id: string; work: ContestWork | null; place?: number; prizeTitle?: string }[];
  };
};
export type ContestEntryStatus =
  | "PENDING"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "HIDDEN";
export type ContestEntry = {
  id: string;
  publicId: string;
  version: number;
  status: ContestEntryStatus;
  revisionId: string;
  albumId: string;
  albumTitle: string;
  number: number | null;
  caption: string;
  reason: string | null;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
};
export type SubmitContestEntryInput = ContestConsentInput & {
  photo?: File;
  albumId: string;
  number?: number;
  caption: string;
  version?: number;
};

export type ContestConsentOffer = {
  id: string;
  validUntil: string;
  conditions: { id: string; title: string; sha256: string; href: string };
  documents: {
    id: string;
    revisionId: string;
    version: string;
    title: string;
    href: string;
    sha256: string;
  }[];
};
export type ContestConsentInput = {
  consentOfferId: string;
  personalDataAccepted: boolean;
  publicationAccepted: boolean;
};
