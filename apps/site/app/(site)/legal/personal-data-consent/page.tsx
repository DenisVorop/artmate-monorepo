import { getLegalMetadata, LegalPage } from "@/pages/legal";

export const metadata = getLegalMetadata("personalDataConsent");

export default function Page() {
  return <LegalPage documentId="personalDataConsent" />;
}
