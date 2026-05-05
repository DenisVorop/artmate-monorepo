import { AccountPage } from "@/pages/account";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.account,
    fallback: createPageMetadata("account"),
  });
}

export default function Page() {
  return <AccountPage />;
}
