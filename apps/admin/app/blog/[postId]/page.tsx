import { notFound, redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { blogQuery } from "@/entities/blog";
import { BlogPostPage } from "@/pages/blog-post";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export { metadata } from "@/pages/blog-post/metadata";

type BlogPostRouteProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function Page({ params }: BlogPostRouteProps) {
  const { postId } = await params;
  const session = await getAdminSession();

  if (!session.user) {
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.blogPost(postId))}`,
    );
  }

  const queryClient = getQueryClient();

  await fetchAdminBlogPostOrNotFound(queryClient, postId);
  await Promise.all([
    queryClient.prefetchQuery(blogQuery.authors()),
    queryClient.prefetchQuery(blogQuery.categories()),
    queryClient.prefetchQuery(blogQuery.tags()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <BlogPostPage currentUser={session.user} postId={postId} />
    </HydrationBoundary>
  );
}

async function fetchAdminBlogPostOrNotFound(
  queryClient: ReturnType<typeof getQueryClient>,
  postId: string,
) {
  try {
    await queryClient.fetchQuery(blogQuery.detail(postId));
  } catch (error) {
    if (isBlogPostNotFoundError(error)) {
      notFound();
    }

    throw error;
  }
}

function isBlogPostNotFoundError(error: unknown) {
  return error instanceof Error && error.message === "Blog post not found";
}
