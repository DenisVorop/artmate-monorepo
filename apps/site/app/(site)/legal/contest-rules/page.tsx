import { notFound } from "next/navigation";
import { contestRulesRevisions, legalDocuments, LegalPage } from "@/pages/legal";
import { createLegalMetadata, Seo } from "@/shared/lib/seo";
export function generateMetadata() {
  const document = legalDocuments.contestRules;
  return Seo.getMetadata({ path: document.href, fallback: createLegalMetadata(document) });
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ version?: string | string[] }>;
}) {
  const { version } = await searchParams;
  if (version === undefined) return <LegalPage documentId="contestRules" />;
  if (typeof version !== "string" || !Object.hasOwn(contestRulesRevisions, version)) notFound();
  return (
    <LegalPage document={contestRulesRevisions[version as keyof typeof contestRulesRevisions]} />
  );
}
