export const aiBlogDraftSourceTypes = [
  "mixed",
  "product_news",
  "internet_research",
] as const;
export type AiBlogDraftSourceType = (typeof aiBlogDraftSourceTypes)[number];

export const aiBlogDraftRunStatuses = [
  "topic_review",
  "outline_review",
  "draft_review",
  "draft_created",
  "rejected",
  "failed",
] as const;
export type AiBlogDraftRunStatus = (typeof aiBlogDraftRunStatuses)[number];

export type StartAiBlogDraftRunInputDTO = {
  prompt?: string;
  sourceType?: AiBlogDraftSourceType;
};

export type AiBlogDraftRunDTO = {
  blogPostId?: string;
  createdAt: string;
  draft?: unknown;
  errorMessage?: string;
  id: string;
  outline?: unknown;
  prompt?: string;
  selectedTopicIndex?: number;
  sources?: unknown;
  sourceType: AiBlogDraftSourceType;
  status: AiBlogDraftRunStatus;
  topics?: unknown;
  updatedAt: string;
};
