"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import { useBlogManagement } from "../model";
import { AiBlogDraftCard } from "./ai-draft-card";
import { CreateBlogPostCard } from "./create-post-card";
import { BlogPostsList } from "./posts-list";

export function BlogPostsManagement() {
  const {
    authors,
    categories,
    isError,
    isPending,
    posts,
    refreshBlogView,
    tags,
  } = useBlogManagement();

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить посты</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Перезагрузите страницу и повторите действие.
        </CardContent>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка постов</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем посты, авторов, категории и теги.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <AiBlogDraftCard />
      <CreateBlogPostCard
        authors={authors}
        categories={categories}
        onBlogChange={refreshBlogView}
        tags={tags}
      />
      <BlogPostsList posts={posts} />
    </div>
  );
}
