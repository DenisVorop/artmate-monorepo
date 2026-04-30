import { routes } from "@/shared/constants";

export function getSafeRedirectPath(path?: string | null) {
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    isLoginPath(path)
  ) {
    return routes.users;
  }

  return path;
}

function isLoginPath(path: string) {
  return (
    path === routes.login ||
    path.startsWith(`${routes.login}/`) ||
    path.startsWith(`${routes.login}?`) ||
    path.startsWith(`${routes.login}#`)
  );
}
