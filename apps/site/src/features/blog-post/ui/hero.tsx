import { Calendar, Clock } from "lucide-react";

import type { BlogPost } from "@/entities/blog";
import { Avatar, AvatarFallback, Badge } from "@/shared/ui";
import { PageTitle, SectionTitle } from "@/shared/ui/typography";
import { Breadcrumbs } from "./breadcrumbs";

type HeroProps = {
  post: BlogPost;
  continuation?: boolean;
};

export function Hero({ post, continuation = false }: HeroProps) {
  const Title = continuation ? SectionTitle : PageTitle;
  return (
    <section className="border-b bg-gradient-to-b from-muted/60 via-background to-background">
      <div className="container py-6 md:py-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 md:gap-6">
          <Breadcrumbs post={post} />

          <div className="flex flex-col items-center gap-4 text-center">
            <Title className="text-foreground">{post.title}</Title>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              {post.excerpt}
            </p>
          </div>

          <div
            data-article-about
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-rose-100 text-xs font-bold text-rose-600">
                  {post.author.avatar}
                </AvatarFallback>
              </Avatar>
              {post.author.name}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4" />
              {post.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" />
              {post.readTime} чтения
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{post.category}</Badge>
              {post.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
