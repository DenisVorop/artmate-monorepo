import { redirect } from "next/navigation";

import { getSafeAuthRedirectPath } from "@/features/auth";
import { getAuthSession } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import { createPageMetadata } from "@/shared/lib/seo";
import { AuthPage } from "@/pages/auth";

export const metadata = createPageMetadata("auth");

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

    redirect(getSafeAuthRedirectPath(Array.isArray(next) ? next[0] : next));
  }

  return <AuthPage />;
}
