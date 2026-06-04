import { redirect } from "next/navigation";

import { MailingsPage } from "@/pages/mailings";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";

export { metadata } from "@/pages/mailings/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.mailings)}`);
  }

  return <MailingsPage currentUser={session.user} />;
}
