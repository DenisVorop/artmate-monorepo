"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import {
  formatBlogPostDate,
  formatBlogPostReadTime,
  getBlogPostContentBlocksCount,
  getBlogPostStatusBadgeVariant,
  getBlogPostStatusLabel,
  type BlogPost,
} from "@/entities/blog";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

type BlogPostsTableProps = {
  readonly posts: readonly BlogPost[];
};

export function BlogPostsTable({ posts }: BlogPostsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Посты</CardTitle>
        <CardDescription>
          Список статей блога. Тело статьи редактируется в карточке поста.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Пост</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Автор</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Блоки</TableHead>
              <TableHead>Чтение</TableHead>
              <TableHead>Опубликован</TableHead>
              <TableHead className="text-right">Карточка</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell className="min-w-72 whitespace-normal">
                  <div className="grid gap-0.5">
                    <span className="font-medium">{post.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {post.slug}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{post.category?.title ?? "Без категории"}</TableCell>
                <TableCell>{post.author.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={getBlogPostStatusBadgeVariant(post.status)}>
                      {getBlogPostStatusLabel(post.status)}
                    </Badge>
                    {post.featured ? (
                      <Badge variant="secondary">В подборке</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{getBlogPostContentBlocksCount(post)}</TableCell>
                <TableCell>{formatBlogPostReadTime(post)}</TableCell>
                <TableCell>{formatBlogPostDate(post.publishedAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    aria-label={`Открыть пост ${post.title}`}
                    asChild
                    size="icon-sm"
                    variant="outline"
                  >
                    <Link href={routes.blogPost(post.id)}>
                      <Eye aria-hidden="true" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
