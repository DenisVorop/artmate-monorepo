import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Artmate — раскраски по номерам, альбом «Котики 2»";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";
export const dynamic = "force-static";

export default async function Image() {
  const image = await readFile(join(process.cwd(), "public/brand/artmate-og-cats2.jpg"));

  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": contentType },
  });
}
