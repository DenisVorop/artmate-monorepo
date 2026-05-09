import { redirect } from "next/navigation";

import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";

export { metadata } from "@/pages/orders/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.orders)}`);
  }

  redirect(routes.orders);
}
