import { legalDocuments, LegalPage } from "@/pages/legal";
import { createLegalMetadata } from "@/shared/lib/seo";

export const metadata = createLegalMetadata(legalDocuments.personalDataConsent);

export default function Page() {
  return <LegalPage documentId="personalDataConsent" />;
}
