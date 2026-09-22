import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountSettingsPage } from "@/pages/account-settings";
import { getAuthSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";

export const metadata: Metadata = {
  title: "Настройки аккаунта",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const session = ApiResult.fromDTO(await getAuthSession()).data;
  if (!session?.user) redirect(`${routes.auth}?next=${encodeURIComponent(routes.accountSettings)}`);
  return <AccountSettingsPage />;
}
