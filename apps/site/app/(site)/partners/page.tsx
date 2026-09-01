import { PartnersPage, partnerFaqSections } from "@/pages/partners";
import { routes } from "@/shared/constants";
import { createPageMetadata, FaqStructuredData, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.partners,
    fallback: createPageMetadata("partners"),
  });
}

export default function Page() {
  return (
    <>
      <FaqStructuredData sections={partnerFaqSections} />
      <PartnersPage />
    </>
  );
}
