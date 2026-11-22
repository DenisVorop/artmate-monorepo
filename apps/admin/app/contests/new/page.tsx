import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContestsPage } from "@/pages/contests";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
export const metadata: Metadata = { title: "Новый конкурс — Artmate Admin" };
export default async function Page() {
  const { user } = await getAdminSession();
  if (!user)
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.contestCreate)}`,
    );
  return <ContestsPage currentUser={user} mode="create" />;
}
