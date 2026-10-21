import { notFound } from "next/navigation";
import { YandexCallback } from "@/features/auth";
import { createPageMetadata } from "@/shared/lib/seo";

export function generateMetadata() {
  return createPageMetadata("auth");
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{
    state?: string | string[];
    code?: string | string[];
    error?: string | string[];
  }>;
}) {
  if ((await params).provider !== "yandex") notFound();
  const query = await searchParams;
  const _first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  return (
    <YandexCallback
      input={{
        state: _first(query.state) ?? "",
        code: _first(query.code),
        error: _first(query.error),
      }}
    />
  );
}
