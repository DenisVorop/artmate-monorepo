import type { BlogPost, BlogPostStatus } from "../model";

export function getBlogPostStatusLabel(status: BlogPostStatus) {
  switch (status) {
    case "draft":
      return "Черновик";
    case "published":
      return "Опубликован";
    case "archived":
      return "Архив";
  }
}

export function getBlogPostStatusBadgeVariant(status: BlogPostStatus) {
  switch (status) {
    case "published":
      return "default";
    case "archived":
      return "secondary";
    case "draft":
      return "outline";
  }
}

export function formatBlogPostDate(value?: string) {
  if (!value) {
    return "Не указано";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatBlogPostReadTime(post: Pick<BlogPost, "readTimeMinutes">) {
  return post.readTimeMinutes ? `${post.readTimeMinutes} мин` : "Не указано";
}

export function getBlogPostContentBlocksCount(post: Pick<BlogPost, "content">) {
  return post.content?.blocks.length ?? 0;
}
