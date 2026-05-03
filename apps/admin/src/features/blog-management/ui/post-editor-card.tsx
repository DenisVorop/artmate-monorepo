"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Trash2 } from "lucide-react";

import {
  formatBlogPostDate,
  getBlogPostStatusBadgeVariant,
  getBlogPostStatusLabel,
  type BlogAuthor,
  type BlogCategory,
  type BlogPost,
  type BlogTag,
} from "@/entities/blog";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import {
  deleteBlogPostFormSchema,
  type BlogRefreshCallback,
  type DeleteBlogPostFormValues,
} from "../lib";
import { useDeleteBlogPost } from "../model";
import { BlogPostForm } from "./post-form";

type BlogPostEditorCardProps = {
  readonly authors: readonly BlogAuthor[];
  readonly categories: readonly BlogCategory[];
  readonly onBlogPostDeleted?: BlogRefreshCallback;
  readonly onBlogPostSaved: BlogRefreshCallback;
  readonly post: BlogPost;
  readonly tags: readonly BlogTag[];
};

export function BlogPostEditorCard({
  authors,
  categories,
  onBlogPostDeleted,
  onBlogPostSaved,
  post,
  tags,
}: BlogPostEditorCardProps) {
  const { handleSubmit, register } = useForm<DeleteBlogPostFormValues>({
    defaultValues: {
      postId: post.id,
    },
    resolver: zodResolver(deleteBlogPostFormSchema),
  });
  const { isPending: isDeletingPost, mutate: deletePost } = useDeleteBlogPost({
    onSuccess: onBlogPostDeleted ?? onBlogPostSaved,
  });
  const submitDeleteForm = handleSubmit((values) => {
    deletePost(values.postId);
  });

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate">{post.title}</CardTitle>
          <CardDescription>
            {post.slug} · {post.category.title} · {post.author.name} · обновлен{" "}
            {formatBlogPostDate(post.updatedAt)}
          </CardDescription>
        </div>
        <CardAction className="flex items-start gap-2">
          {post.featured ? <Badge variant="secondary">В подборке</Badge> : null}
          <Badge variant={getBlogPostStatusBadgeVariant(post.status)}>
            {getBlogPostStatusLabel(post.status)}
          </Badge>
          <form onSubmit={submitDeleteForm}>
            <input type="hidden" {...register("postId")} />
            <Button
              aria-label={`Удалить пост ${post.title}`}
              disabled={isDeletingPost}
              size="icon-sm"
              type="submit"
              variant="destructive"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </form>
        </CardAction>
      </CardHeader>
      <CardContent>
        <BlogPostForm
          authors={authors}
          categories={categories}
          onSaved={onBlogPostSaved}
          post={post}
          tags={tags}
        />
      </CardContent>
    </Card>
  );
}
