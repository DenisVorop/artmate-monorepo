import { EmailUnsubscribePage } from "@/pages/email-unsubscribe";
import { createPageMetadata } from "@/shared/lib/seo";

export const metadata = createPageMetadata("emailUnsubscribe");

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <EmailUnsubscribePage token={typeof token === "string" ? token : undefined} />;
}
