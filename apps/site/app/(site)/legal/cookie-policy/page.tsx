import { getLegalMetadata, LegalPage } from "@/pages/legal";

export const metadata = getLegalMetadata("cookiePolicy");

export default function Page() {
  return <LegalPage documentId="cookiePolicy" />;
}
