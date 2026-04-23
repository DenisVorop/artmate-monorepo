import { ArrowRight, Calendar, Clock } from "lucide-react";

import type { BlogArticleContent, BlogArticleSection, BlogPost } from "@/entities/blog";
import { TableOfContents } from "@/features/blog-post";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared";
import { Link } from "@/shared/ui/link";

type SidebarProps = {
  post: BlogPost;
  sections: BlogArticleSection[];
  cta: BlogArticleContent["cta"];
};

export function Sidebar({ post, sections, cta }: SidebarProps) {
  const tocItems = sections.map((section) => ({
    id: section.id,
    label: section.label ?? section.heading,
  }));

  return (
    <aside className="hidden space-y-4 xl:sticky xl:top-24 xl:block">
      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle>О статье</CardTitle>
          <CardDescription>Быстрая справка перед чтением.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{post.category}</Badge>
            {post.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <Calendar className="size-4" />
              {post.date}
            </p>
            <p className="flex items-start gap-2">
              <Clock className="size-4" />
              {post.readTime} чтения
            </p>
          </div>
        </CardContent>
      </Card>

      {tocItems.length > 1 ? (
        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle>Содержание</CardTitle>
            <CardDescription>Переходите к нужному разделу без лишнего скролла.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <TableOfContents items={tocItems} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle>{cta.title}</CardTitle>
          <CardDescription>{cta.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            asChild
            className="w-full border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/90 hover:via-rose-400/90 hover:to-orange-400/90"
          >
            <Link href={cta.href}>
              {cta.label}
              <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}
