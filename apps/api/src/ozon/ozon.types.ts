export type OzonOAuthAccessType = "online" | "offline";

export type OzonOAuthTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
  token_type?: unknown;
};

export type OzonStoredOAuthToken = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  scope: string[];
  tokenType?: string;
  updatedAt?: number;
};

export type OzonTokenStatus = {
  configured: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  persisted: boolean;
  expiresAt?: string;
  updatedAt?: string;
  scope: string[];
  tokenType?: string;
};
