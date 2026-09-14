import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioPage } from "@/pages/studio/ui/page";
export const metadata: Metadata = {
  title: "Проект раскраски — Artmate Studio",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!/^[0-9a-f]{32}$/.test(projectId)) notFound();
  return <StudioPage projectId={projectId} />;
}
