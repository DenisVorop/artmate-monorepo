import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogPostDataBuilder } from "@/app/lib/blog-post-data-builder";
import { blogPostPageQuery } from "@/features/blog-post";
import { BlogPostPage } from "@/pages/blog-post";
import { getBlogPostBySlug } from "@/shared/actions/blog";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { BlogPostStructuredData, createBlogPostMetadata, Seo } from "@/shared/lib/seo";
import { HydrationBoundary } from "@tanstack/react-query";

type BlogPostRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: BlogPostRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {};
  }

  return Seo.getMetadata({
    path: routes.blogPost(post.slug),
    fallback: createBlogPostMetadata(post),
  });
}

export default async function Page({ params }: BlogPostRouteProps) {
  const { slug } = await params;
  const { queryClient } = await new BlogPostDataBuilder().withPostPage(slug).build();
  const postPageData = queryClient.getQueryData(blogPostPageQuery(slug).queryKey);

  if (!postPageData?.post || !postPageData.content) {
    notFound();
  }

  return (
    <>
      <BlogPostStructuredData content={postPageData.content} post={postPageData.post} />
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        <BlogPostPage slug={slug} />
      </HydrationBoundary>
    </>
  );
}
