"use client";

import type { BlogAuthor, BlogCategory, BlogTag } from "@/entities/blog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import type { BlogRefreshCallback } from "../lib";
import { BlogPostForm } from "./post-form";

type CreateBlogPostCardProps = {
  readonly authors: readonly BlogAuthor[];
  readonly categories: readonly BlogCategory[];
  readonly onBlogChange: BlogRefreshCallback;
  readonly tags: readonly BlogTag[];
};

export function CreateBlogPostCard({
  authors,
  categories,
  onBlogChange,
  tags,
}: CreateBlogPostCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый пост</CardTitle>
        <CardDescription>
          Заполните метаданные и соберите статью из блоков.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BlogPostForm
          authors={authors}
          categories={categories}
          onSaved={onBlogChange}
          tags={tags}
        />
      </CardContent>
    </Card>
  );
}
