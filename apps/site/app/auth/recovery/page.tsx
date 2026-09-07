import { AccountRecovery } from "@/features/account-recovery";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.authRecovery,
    fallback: createPageMetadata("auth"),
  });
}

export default function Page() {
  return <AccountRecovery />;
}
