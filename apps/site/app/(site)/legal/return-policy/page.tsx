import { getLegalMetadata, LegalPage } from "@/pages/legal";

export const metadata = getLegalMetadata("returnPolicy");

export default function Page() {
  return <LegalPage documentId="returnPolicy" />;
}
