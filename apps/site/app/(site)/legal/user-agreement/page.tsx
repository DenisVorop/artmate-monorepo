import { legalDocuments, LegalPage } from "@/pages/legal";
import { createLegalMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  const document = legalDocuments.userAgreement;

  return Seo.getMetadata({
    path: document.href,
    fallback: createLegalMetadata(document),
  });
}

export default function Page() {
  return <LegalPage documentId="userAgreement" />;
}
