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
  consentAcceptances: {
    id: string;
    acceptedAt: string;
    endsAt: string;
    revision: {
      documentTitle: string;
      version: string;
      documentSha256: string;
      formSha256: string;
    };
  }[];
  legalAcceptance: null | {
    actor: { name: string | null; email: string };
    publication: {
      publicName: string | null;
      fields: string[];
      resources: { id: string; label: string; urls: string[] }[];
      restriction: string;
    };
  };
  author: { name: string; email: string | null };
  contest: {
    id: string;
    title: string;
    closesAt: string;
    task: string;
    rules: string[];
  };
  events: {
    id: string;
    status: ContestEntryStatus;
    reason: string | null;
    revision: number;
    actor: string;
    createdAt: string;
  }[];
};
export type ContestEntryDecision = {
  status: Exclude<ContestEntryStatus, "PENDING">;
  version: number;
  reason?: string;
};
export type ContestEntriesPage = {
  entries: ContestEntry[];
  nextCursor: string | null;
};
