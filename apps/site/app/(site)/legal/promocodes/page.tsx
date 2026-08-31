import { legalDocuments, PromocodesLegalPage } from "@/pages/legal";
import { createLegalMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  const document = legalDocuments.promocodes;

  return Seo.getMetadata({
    path: document.href,
    fallback: createLegalMetadata(document),
  });
}

export default function Page() {
  return <PromocodesLegalPage />;
}
