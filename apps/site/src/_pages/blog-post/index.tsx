"use client";

import { ReadingProgress, useBlogPostPageData } from "@/features/blog-post";
import { Separator } from "@/shared/ui";
import { Article } from "./ui/article";
import { Hero } from "./ui/hero";
import { Related } from "./ui/related";
import { Sidebar } from "./ui/sidebar";

const BLOG_POST_ARTICLE_ID = "blog-post-article";

type BlogPostPageProps = {
  slug: string;
};

export function BlogPostPage({ slug }: BlogPostPageProps) {
  const { post, content, relatedPosts } = useBlogPostPageData(slug);

  if (!post || !content) {
    return null;
  }

  return (
    <main className="bg-background">
      <ReadingProgress articleId={BLOG_POST_ARTICLE_ID} />

      <Hero post={post} />

      <div className="container py-5 md:py-8">
        <div className="mx-auto max-w-4xl space-y-5 md:space-y-8">
          <section className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-10">
            <Article articleId={BLOG_POST_ARTICLE_ID} post={post} content={content} />
            <Sidebar post={post} sections={content.sections} cta={content.cta} />
          </section>

          {relatedPosts.length > 0 ? (
            <>
              <Separator />
              <Related posts={relatedPosts} />
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
