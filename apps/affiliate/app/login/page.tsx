import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginPage } from "@/pages/login";
import {
  getAffiliateAccess,
  getSafeRedirectPath,
} from "@/features/auth/server";
import { routes } from "@/shared/constants";

export const metadata: Metadata = { title: "Вход" };

type LoginRouteProps = {
  readonly searchParams: Promise<{ next?: string | string[] }>;
};

export default async function Page({ searchParams }: LoginRouteProps) {
  const { next } = await searchParams;
  const nextPath = Array.isArray(next) ? next[0] : next;
  const access = await getAffiliateAccess();

  if (access.decision === "allow") {
    redirect(getSafeRedirectPath(nextPath));
  }

  if (access.decision === "denied") {
    redirect(routes.accessDenied);
  }

  if (access.decision === "error") {
    redirect(routes.unavailable);
  }

  return <LoginPage nextPath={nextPath} />;
}
