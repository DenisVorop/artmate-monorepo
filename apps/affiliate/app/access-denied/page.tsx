import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessDeniedPage } from "@/pages/access-denied";
import { getAffiliateAccess } from "@/features/auth/server";
import { routes } from "@/shared/constants";

export const metadata: Metadata = { title: "Доступ не открыт" };

export default async function Page() {
  const access = await getAffiliateAccess();

  if (access.decision === "login") {
    redirect(routes.login);
  }

  if (access.decision === "allow") {
    redirect(routes.home);
  }

  if (access.decision === "error") {
    redirect(routes.unavailable);
  }

  return <AccessDeniedPage />;
}
