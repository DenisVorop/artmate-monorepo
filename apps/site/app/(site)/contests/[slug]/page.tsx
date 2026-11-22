import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { ContestsDataBuilder } from "@/app/lib/contests-data-builder";
import { contestsQuery } from "@/entities/contest";
import { ContestPage } from "@/pages/contests";
import { getContest } from "@/shared/actions/contests";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getContest(slug);
  return {
    title: `${result.data?.title ?? "Конкурс"} — Artmate`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { queryClient } = await new ContestsDataBuilder().withContest(slug).build();
  const error = queryClient.getQueryState(contestsQuery.detail(slug).queryKey)?.error;
  if (error && "status" in error && error.status === 404) notFound();
  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <ContestPage slug={slug} />
    </HydrationBoundary>
  );
}
