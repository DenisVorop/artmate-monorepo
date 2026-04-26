import { getLegalMetadata, LegalPage } from "@/pages/legal";

export const metadata = getLegalMetadata("privacyPolicy");

export default function Page() {
  return <LegalPage documentId="privacyPolicy" />;
}
