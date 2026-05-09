import { redirect } from "next/navigation";

import { FeatureBannersPage } from "@/pages/feature-banners";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";

export { metadata } from "@/pages/feature-banners/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.featureBanners)}`);
  }

  return <FeatureBannersPage />;
}
