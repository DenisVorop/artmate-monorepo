import { getLegalMetadata, LegalPage } from "@/pages/legal";

export const metadata = getLegalMetadata("publicOffer");

export default function Page() {
  return <LegalPage documentId="publicOffer" />;
}
