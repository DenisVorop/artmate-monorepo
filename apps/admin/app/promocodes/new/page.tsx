import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PromoCodeCreatePage } from "@/pages/promo-code-create";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";

export const metadata: Metadata = { title: "Новый промокод - Artmate Admin" };

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.promoCodeCreate)}`,
    );
  }

  return <PromoCodeCreatePage currentUser={session.user} />;
}
