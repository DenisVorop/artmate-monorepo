export type EmailSubscriptionDTO = {
  email: string;
  subscribed: boolean;
  version: number;
  stateRevision: number;
  grantRevisionId?: string;
};

export type GrantEmailSubscriptionInputDTO = {
  revisionId: string;
  expectedVersion: number;
  expectedStateRevision: number;
};

export type UnsubscribeEmailInputDTO = { token: string };
export type UnsubscribeEmailResultDTO = { unsubscribed: true };
