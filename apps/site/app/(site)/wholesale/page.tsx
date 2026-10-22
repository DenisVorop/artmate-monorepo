import { WholesalePage } from "@/pages/wholesale";
import { createPageMetadata, WholesaleStructuredData } from "@/shared/lib/seo";

export function generateMetadata() {
  return createPageMetadata("wholesale");
}

export default function Page() {
  return (
    <>
      <WholesaleStructuredData />
      <WholesalePage />
    </>
  );
}
