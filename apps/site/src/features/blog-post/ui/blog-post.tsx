"use client";

import { useMemo } from "react";
import type { BlogArticleContent, BlogCtaBlock, BlogPost as BlogPostData } from "@/entities/blog";
import { Button } from "@/shared/ui";
import { BlogPostStructuredData } from "@/shared/lib/seo";
import { useBlogPostPageData } from "../model/use-blog-post-page-data";
import { useReadingLayout } from "../lib/use-reading-layout";
import { useReadingStream } from "../model/use-reading-stream";
import { useCurrentArticle } from "../lib/use-current-article";
import { useArticleMetadata } from "../lib/use-article-metadata";
import { articleElementId } from "../lib/reading-stream";
import { Article } from "./article";
import { Hero } from "./hero";
import { ReadingProgress } from "./reading-progress";
import { Navigation } from "./navigation";
import { Cta } from "./cta";
import { Related } from "./related";

export function BlogPost({ slug }: { slug: string }) {
  const { post, content, relatedPosts } = useBlogPostPageData(slug);
  if (!post || !content) return null;
  return <BaseBlogPost key={slug} post={post} content={content} relatedPosts={relatedPosts} />;
}

type BaseBlogPostProps = {
  post: BlogPostData;
  content: BlogArticleContent;
  relatedPosts?: BlogPostData[];
};

export function BaseBlogPost({ post, content, relatedPosts = [] }: BaseBlogPostProps) {
  const readingRef = useReadingLayout();
  const { pages, status, sentinelRef, loadNext } = useReadingStream({
    post,
    content,
    relatedPosts,
  });
  const posts = useMemo(() => pages.flatMap((page) => (page.post ? [page.post] : [])), [pages]);
  const activeSlug = useCurrentArticle(posts);
  const activePage = pages.find((page) => page.post?.slug === activeSlug) ?? pages[0]!;
  const lastPage = pages[pages.length - 1]!;
  const cta = activePage.content?.blocks.find(
    (block): block is BlogCtaBlock => block.type === "cta",
  );
  useArticleMetadata(activePage.post!);

  return (
    <main className="bg-background">
      <BlogPostStructuredData content={activePage.content!} post={activePage.post!} />
      <ReadingProgress articleId={`${articleElementId(activeSlug)}-body`} />
      <Hero post={post} />
      <div
        ref={readingRef}
        data-article-layout="right-sidebar"
        className="container max-w-[68rem] py-5 [--article-sticky-top:var(--site-header-nav-height)] md:py-8"
      >
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,44rem)_18rem] lg:items-start lg:justify-center">
          <div
            data-article-sidebar
            className="contents lg:sticky lg:top-[calc(var(--article-sticky-top)+1.25rem)] lg:col-start-2 lg:row-start-1 lg:flex lg:max-h-[calc(100dvh-var(--article-sticky-top)-2.25rem)] lg:min-w-0 lg:flex-col lg:gap-4 lg:self-start"
          >
            <Navigation key={activeSlug} content={activePage.content!} slug={activeSlug} />
            {cta ? <Cta cta={cta} /> : null}
          </div>
          <div className="min-w-0 space-y-12 lg:col-start-1 lg:row-start-1">
            {pages.map((page, index) =>
              page.post && page.content ? (
                <section
                  key={page.post.slug}
                  id={articleElementId(page.post.slug)}
                  data-reading-article={page.post.slug}
                  aria-label={page.post.title}
                  className="space-y-8"
                >
                  {index > 0 ? <Hero post={page.post} continuation /> : null}
                  <Article
                    articleId={`${articleElementId(page.post.slug)}-body`}
                    post={page.post}
                    content={page.content}
                    preload={index === 0}
                  />
                </section>
              ) : null,
            )}
            <div ref={sentinelRef} data-reading-next className="py-6 text-center">
              <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {status === "loading" ? "Загружаем следующую статью…" : null}
                {status === "error" ? "Не удалось загрузить следующую статью." : null}
              </div>
              {status === "error" ? (
                <Button variant="outline" className="mt-3" onClick={() => void loadNext()}>
                  Попробовать ещё раз
                </Button>
              ) : null}
            </div>
            {status === "done" && lastPage.post ? (
              <Related posts={lastPage.relatedPosts} slug={lastPage.post.slug} />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
