import { redirect } from "next/navigation";

import { DashboardPage } from "@/pages/dashboard";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";

export { metadata } from "@/pages/dashboard/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.dashboard)}`);
  }

  return <DashboardPage user={session.user} />;
}
