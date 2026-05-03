import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { blogQuery } from "@/entities/blog";
import { BlogPage } from "@/pages/blog";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export { metadata } from "@/pages/blog/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.blog)}`);
  }

  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(blogQuery.authors()),
    queryClient.prefetchQuery(blogQuery.categories()),
    queryClient.prefetchQuery(blogQuery.list()),
    queryClient.prefetchQuery(blogQuery.tags()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <BlogPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
