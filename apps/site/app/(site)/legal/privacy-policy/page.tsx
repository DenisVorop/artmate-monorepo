import { legalDocuments, LegalPage } from "@/pages/legal";
import { createLegalMetadata } from "@/shared/lib/seo";

export const metadata = createLegalMetadata(legalDocuments.privacyPolicy);

export default function Page() {
  return <LegalPage documentId="privacyPolicy" />;
}
