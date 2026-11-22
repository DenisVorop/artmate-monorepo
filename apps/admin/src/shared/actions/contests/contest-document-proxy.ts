import "server-only";
import { cookies } from "next/headers";
export async function proxyContestDocument(slug: string, id: string) {
  const token = (await cookies()).get("artmate_access_token")?.value;
  if (!token) return new Response(null, { status: 401 });
  const response = await fetch(
    `${process.env.API_BASE_URL ?? "http://localhost:3002"}/contests/${encodeURIComponent(slug)}/legal/${encodeURIComponent(id)}/file`,
    {
      cache: "no-store",
      headers: { cookie: `artmate_access_token=${encodeURIComponent(token)}` },
    },
  );
  if (!response.ok) return new Response(null, { status: response.status });
  return new Response(response.body, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
