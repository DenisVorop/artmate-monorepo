"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import { useBlogManagement } from "../model";
import { CreateBlogPostCard } from "./create-post-card";
import { BlogDictionariesCard } from "./dictionaries-card";
import { BlogPostsList } from "./posts-list";

export function BlogManagement() {
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
          <CardTitle>Не удалось загрузить блог</CardTitle>
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
          <CardTitle>Загрузка блога</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем посты, авторов, категории и теги.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <BlogDictionariesCard
        authors={authors}
        categories={categories}
        onBlogChange={refreshBlogView}
        tags={tags}
      />
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
