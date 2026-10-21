import { routes } from "@/shared/constants";

/** Token-bearing pages use a separate document without third-party tracking. */
export function isSensitivePath(pathname: string) {
  return (
    pathname === routes.unsubscribe ||
    pathname === routes.authOrderActivation ||
    pathname === routes.authResetPassword ||
    pathname.startsWith(`${routes.auth}/oauth/`)
  );
}
