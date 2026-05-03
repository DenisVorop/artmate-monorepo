import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { blogQuery } from "@/entities/blog";
import { BlogDirectoryPage } from "@/pages/blog-directory";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export { blogAuthorsMetadata as metadata } from "@/pages/blog-directory/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.blogAuthors)}`);
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(blogQuery.authors());

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <BlogDirectoryPage currentUser={session.user} directory="authors" />
    </HydrationBoundary>
  );
}
