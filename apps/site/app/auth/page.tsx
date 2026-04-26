import { redirect } from "next/navigation";

import { AuthPage } from "@/pages/auth";
import { getAuthSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";

export { metadata } from "@/pages/auth/metadata";

type AuthRouteProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

export default async function Page({ searchParams }: AuthRouteProps) {
  const result = ApiResult.fromDTO(await getAuthSession());
  const session = result.isError ? undefined : result.data;

  if (session?.user) {
    const { next } = await searchParams;

    redirect(getSafeRedirectPath(Array.isArray(next) ? next[0] : next));
  }

  return <AuthPage />;
}

function getSafeRedirectPath(path?: string) {
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
