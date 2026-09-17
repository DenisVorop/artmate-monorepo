export const publicSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://artmate.ru";

export const publicSiteRecoveryUrl = `${publicSiteUrl.replace(/\/$/, "")}/auth/recovery`;
