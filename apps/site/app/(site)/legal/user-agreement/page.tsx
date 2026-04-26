import { getLegalMetadata, LegalPage } from "@/pages/legal";

export const metadata = getLegalMetadata("userAgreement");

export default function Page() {
  return <LegalPage documentId="userAgreement" />;
}
