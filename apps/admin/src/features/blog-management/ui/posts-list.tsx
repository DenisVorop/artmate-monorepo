"use client";

import type { BlogPost } from "@/entities/blog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import { BlogPostsTable } from "./posts-table";

type BlogPostsListProps = {
  readonly posts: readonly BlogPost[];
};

export function BlogPostsList({ posts }: BlogPostsListProps) {
  if (posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Блог</CardTitle>
          <CardDescription>Посты пока не созданы</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Добавьте первый пост через форму выше
          </div>
        </CardContent>
      </Card>
    );
  }

  return <BlogPostsTable posts={posts} />;
}
