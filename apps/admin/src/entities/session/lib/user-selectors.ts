import type { AuthUser } from "../model";

export function isAdminUser(user: AuthUser | null | undefined) {
  return Boolean(user?.roles.includes("admin"));
}

export function getUserDisplayName(user: AuthUser) {
  return user.name ?? user.email ?? user.providerUserId;
}

export function getUserInitials(user: AuthUser) {
  const source = user.name ?? user.email ?? user.providerUserId;
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
