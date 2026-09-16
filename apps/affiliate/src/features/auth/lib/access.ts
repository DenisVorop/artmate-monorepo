export type AffiliateProfileState =
  | "active"
  | "suspended"
  | "forbidden"
  | "not-requested";

export function getAffiliateAccessDecision(
  hasSession: boolean,
  profileState: AffiliateProfileState,
) {
  if (!hasSession) {
    return "login" as const;
  }

  return profileState === "active" ? ("allow" as const) : ("denied" as const);
}

export function getAccessFailureDecision(status?: number) {
  if (status === 401) {
    return "login" as const;
  }

  if (status === 403 || status === 404) {
    return "denied" as const;
  }

  return "error" as const;
}
