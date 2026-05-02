import { routes } from "@/shared/constants";

export function getSafeAuthRedirectPath(path?: string | null) {
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    isAuthPath(path)
  ) {
    return routes.home;
  }

  return path;
}

function isAuthPath(path: string) {
  return (
    path === routes.auth ||
    path.startsWith(`${routes.auth}/`) ||
    path.startsWith(`${routes.auth}?`) ||
    path.startsWith(`${routes.auth}#`)
  );
}
