import type { AuthUser } from "../model";

export function isAdminUser(user: AuthUser | null | undefined) {
  return Boolean(user?.roles.includes("admin"));
}

export function getUserDisplayName(user: AuthUser) {
  if (user.name) {
    return user.name;
  }

  if (user.provider === "credentials") {
    return user.providerUserId;
  }

  return user.email ?? user.providerUserId;
}

export function getUserInitials(user: AuthUser) {
  const source = getUserDisplayName(user);
  const words = source
    .split(/[\s@._-]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return "A";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}
