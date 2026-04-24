import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogPostDataBuilder } from "@/app/lib/blog-post-data-builder";
import { blogPostPageQuery } from "@/features/blog-post/model/query";
import { BlogPostPage } from "@/pages/blog-post";
import { getBlogPostMetadata } from "@/pages/blog-post/metadata";
import { getBlogPostBySlug, getBlogPosts } from "@/shared/actions/blog";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { HydrationBoundary } from "@tanstack/react-query";

type BlogPostRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const posts = (await getBlogPosts()).data?.items ?? [];

  return posts.map((post) => ({
    slug: post.id,
  }));
}

export async function generateMetadata({ params }: BlogPostRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {};
  }

  return getBlogPostMetadata(post);
}

export default async function Page({ params }: BlogPostRouteProps) {
  const { slug } = await params;
  const { queryClient } = await new BlogPostDataBuilder()
    .withPostPage(slug)
    .build();
  const postPageData = queryClient.getQueryData(blogPostPageQuery(slug).queryKey);

  if (!postPageData?.post || !postPageData.content) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <BlogPostPage slug={slug} />
    </HydrationBoundary>
  );
}
