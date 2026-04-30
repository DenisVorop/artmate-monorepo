import { redirect } from "next/navigation";

import { getSafeRedirectPath } from "@/features/auth";
import { LoginPage } from "@/pages/login";
import { getAdminSession } from "@/shared/actions/auth";

export { metadata } from "@/pages/login/metadata";

type LoginRouteProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

export default async function Page({ searchParams }: LoginRouteProps) {
  const { next } = await searchParams;
  const nextPath = Array.isArray(next) ? next[0] : next;
  const session = await getAdminSession();

  if (session.user) {
    redirect(getSafeRedirectPath(nextPath));
  }

  return <LoginPage nextPath={nextPath} />;
}
