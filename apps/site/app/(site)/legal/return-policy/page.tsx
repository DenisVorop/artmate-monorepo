import { legalDocuments, LegalPage } from "@/pages/legal";
import { createLegalMetadata } from "@/shared/lib/seo";

export const metadata = createLegalMetadata(legalDocuments.returnPolicy);

export default function Page() {
  return <LegalPage documentId="returnPolicy" />;
}
