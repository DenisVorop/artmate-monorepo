import { redirect } from "next/navigation";

import { UsersPage } from "@/pages/users";
import { getAdminSession } from "@/shared/actions/auth";
import { getAdminUsers } from "@/shared/actions/users";
import { routes } from "@/shared/constants";

export { metadata } from "@/pages/users/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.users)}`);
  }

  const users = await getAdminUsers();

  return <UsersPage currentUser={session.user} users={users} />;
}
