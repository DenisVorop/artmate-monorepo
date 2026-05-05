import { AccountPage } from "@/pages/account";
import { createPageMetadata } from "@/shared/lib/seo";

export const metadata = createPageMetadata("account");

export default function Page() {
  return <AccountPage />;
}
