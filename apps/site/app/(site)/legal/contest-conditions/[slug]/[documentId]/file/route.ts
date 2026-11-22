import { proxyContestLegalFile } from "@/shared/actions/contests/legal-document";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; documentId: string }> },
) {
  const { slug, documentId } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^[a-zA-Z0-9]{1,32}$/.test(documentId))
    return new Response(null, { status: 404 });
  return proxyContestLegalFile(slug, documentId);
}
