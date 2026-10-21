import { routes } from "@/shared/constants";

const redirectOrigin = "https://auth-redirect.invalid";

/** A local destination only, normalized before excluding authentication loops. */
export function getSafeAuthRedirectPath(path?: string | null) {
  if (!path || !path.startsWith("/") || _hasUnsafeCharacters(path)) {
    return routes.home;
  }
  try {
    const url = new URL(path, redirectOrigin);
    const decodedPath = decodeURIComponent(url.pathname);
    if (
      url.origin !== redirectOrigin ||
      url.username ||
      url.password ||
      _hasUnsafeCharacters(decodedPath) ||
      decodedPath.includes("%") ||
      decodedPath.startsWith("//") ||
      decodedPath === routes.auth ||
      decodedPath.startsWith(`${routes.auth}/`)
    )
      return routes.home;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return routes.home;
  }
}

function _hasUnsafeCharacters(value: string) {
  return Array.from(value).some(
    (character) =>
      character.charCodeAt(0) <= 0x20 ||
      character.charCodeAt(0) === 0x7f ||
      character === "\\",
  );
}
