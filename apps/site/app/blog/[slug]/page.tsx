import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  BLOG_POSTS,
  getBlogPostBySlug,
  getBlogPostContent,
  getRelatedBlogPosts,
} from "@/entities/blog";
import { BlogPostPage } from "@/pages/blog-post";
import { getBlogPostMetadata } from "@/pages/blog-post/metadata";

type BlogPostRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.id,
  }));
}

export async function generateMetadata({ params }: BlogPostRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {};
  }

  return getBlogPostMetadata(post);
}

export default async function Page({ params }: BlogPostRouteProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const content = getBlogPostContent(post.id);

  if (!content) {
    notFound();
  }

  return <BlogPostPage post={post} content={content} relatedPosts={getRelatedBlogPosts(post)} />;
}
