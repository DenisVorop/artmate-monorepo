import { notFound } from "next/navigation";
import { buildContestLegalPage } from "@/app/lib/contest-legal-data-builder";
import { LegalPage } from "@/pages/legal";
import { createLegalMetadata, Seo } from "@/shared/lib/seo";
type Props = { params: Promise<{ slug: string; documentId: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug, documentId } = await params;
  const document = await buildContestLegalPage(slug, documentId);
  if (!document) return {};
  return Seo.getMetadata({ path: document.href, fallback: createLegalMetadata(document) });
}
export default async function Page({ params }: Props) {
  const { slug, documentId } = await params;
  const document = await buildContestLegalPage(slug, documentId);
  if (!document) notFound();
  return <LegalPage document={document} />;
}
