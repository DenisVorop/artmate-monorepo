import "server-only";
import { cookies } from "next/headers";
export type ContestLegalDocument = {
  id: string;
  title: string;
  sha256: string;
  edition: string;
  updatedAt: string;
  href: string;
  fileHref: string;
};
async function request(slug: string, id: string, file = false) {
  const token = (await cookies()).get("artmate_access_token")?.value;
  return fetch(
    `${process.env.API_BASE_URL ?? "http://localhost:3002"}/contests/${encodeURIComponent(slug)}/legal/${encodeURIComponent(id)}${file ? "/file" : ""}`,
    {
      cache: "no-store",
      headers: token ? { cookie: `artmate_access_token=${encodeURIComponent(token)}` } : {},
    },
  );
}
export async function readContestLegalDocument(
  slug: string,
  id: string,
): Promise<ContestLegalDocument | null> {
  const response = await request(slug, id);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Не удалось загрузить условия конкурса");
  return response.json();
}
export async function proxyContestLegalFile(slug: string, id: string) {
  const response = await request(slug, id, true);
  if (!response.ok)
    return new Response("Документ не найден", { status: response.status === 404 ? 404 : 502 });
  if (response.headers.get("content-type")?.split(";")[0] !== "application/pdf")
    return new Response(null, { status: 502 });
  return new Response(response.body, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename="contest-conditions-${id.replace(/[^a-zA-Z0-9]/g, "")}.pdf"`,
    },
  });
}
