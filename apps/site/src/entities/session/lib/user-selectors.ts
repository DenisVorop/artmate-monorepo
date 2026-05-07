import type { AuthUser } from "../model";

export function getSessionUserDisplayName(user: AuthUser) {
  if (user.name) {
    return user.name;
  }

  if (user.provider === "credentials") {
    return user.providerUserId;
  }

  return user.email ?? user.providerUserId;
}
