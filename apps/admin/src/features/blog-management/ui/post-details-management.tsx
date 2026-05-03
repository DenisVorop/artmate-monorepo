"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import { useBlogPostDetailsManagement } from "../model";
import { BlogPostEditorCard } from "./post-editor-card";

type BlogPostDetailsManagementProps = {
  readonly postId: string;
};

export function BlogPostDetailsManagement({
  postId,
}: BlogPostDetailsManagementProps) {
  const {
    authors,
    categories,
    handleBlogPostDeleted,
    isError,
    isPending,
    post,
    refreshBlogPostView,
    tags,
  } = useBlogPostDetailsManagement(postId);

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось обновить данные</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Перезагрузите страницу и повторите действие.
        </CardContent>
      </Card>
    );
  }

  if (isPending || !post) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка поста</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем данные карточки.
        </CardContent>
      </Card>
    );
  }

  return (
    <BlogPostEditorCard
      authors={authors}
      categories={categories}
      onBlogPostDeleted={handleBlogPostDeleted}
      onBlogPostSaved={refreshBlogPostView}
      post={post}
      tags={tags}
    />
  );
}
