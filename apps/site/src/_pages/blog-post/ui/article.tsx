import Image from "next/image";
import { ArrowLeft, Quote, Share2, Tag } from "lucide-react";

import type { BlogArticleContent, BlogPost, BlogPostBlock } from "@/entities/blog";
import { ShareActions } from "@/features/blog-post";
import { AspectRatio, Avatar, AvatarFallback, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Separator } from "@/shared/ui";
import { getAbsoluteUrl, routes } from "@/shared/constants";
import { Link } from "@/shared/ui/link";
import { SectionTitle } from "@/shared/ui/typography";

type ArticleProps = {
  articleId: string;
  post: BlogPost;
  content: BlogArticleContent;
};

export function Article({ articleId, post, content }: ArticleProps) {
  const shareUrl = getAbsoluteUrl(routes.blogPost(post.slug));

  return (
    <article id={articleId} className="space-y-8">
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-base leading-7 text-muted-foreground md:text-lg">{post.excerpt}</p>
        </CardContent>
      </Card>

      <div className="space-y-10">
        {content.blocks.map((block, index) => (
          <BlockRenderer key={block.id} block={block} showSeparator={index > 0} />
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="size-4 text-muted-foreground" />
          {post.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar size="lg">
                <AvatarFallback>{post.author.avatar}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{post.author.name}</CardTitle>
                  <CardDescription>{post.author.role}</CardDescription>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{post.author.bio}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Share2 className="size-4" />
              Поделиться статьёй
            </div>
            <CardDescription>
              Сохраните ссылку себе или отправьте материал тому, кому он сейчас пригодится.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShareActions title={post.title} url={shareUrl} />
          </CardContent>
        </Card>

        <Button asChild variant="outline">
          <Link href={routes.blog}>
            <ArrowLeft />
            Все статьи блога
          </Link>
        </Button>
      </div>
    </article>
  );
}

function BlockRenderer({ block, showSeparator }: { block: BlogPostBlock; showSeparator: boolean }) {
  if (block.type === "heading") {
    const headingId = block.anchor ?? block.id;

    return (
      <section id={headingId} className="scroll-mt-24 space-y-5">
        {showSeparator ? <Separator /> : null}
        <SectionTitle className="text-foreground">{block.text}</SectionTitle>
      </section>
    );
  }

  if (block.type === "paragraph") {
    return (
      <p className="text-base leading-7 text-muted-foreground">
        {block.text}
      </p>
    );
  }

  if (block.type === "image") {
    return (
      <Card className="overflow-hidden py-0">
        <figure>
          <AspectRatio ratio={16 / 9} className="relative bg-muted">
            <Image
              fill
              src={block.src}
              alt={block.alt}
              sizes="(min-width: 1280px) 720px, (min-width: 768px) 80vw, 100vw"
              className="object-cover"
            />
          </AspectRatio>
          {block.caption ? (
            <figcaption className="border-t px-4 py-3 text-sm leading-relaxed text-muted-foreground">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      </Card>
    );
  }

  if (block.type === "quote") {
    return (
      <Card className="bg-rose-50/60 ring-rose-200">
        <CardContent className="pt-6">
          <Quote className="mb-3 size-5 text-rose-500" />
          <blockquote className="space-y-3">
            <p className="text-base leading-7 text-foreground italic">{block.text}</p>
            {block.author ? (
              <cite className="text-sm text-muted-foreground not-italic">{block.author}</cite>
            ) : null}
          </blockquote>
        </CardContent>
      </Card>
    );
  }

  if (block.type === "highlights") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {block.items.map((item) => (
          <Card key={item.title} size="sm">
            <CardContent className="pt-4">
              <div className="flex gap-3">
                {item.emoji ? (
                  <span className="text-2xl leading-none">{item.emoji}</span>
                ) : null}
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (block.type === "steps") {
    return (
      <div className="space-y-3">
        {block.items.map((item, index) => (
          <Card key={`${item.title}-${index}`} size="sm">
            <CardContent className="pt-4">
              <div className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle>{block.title}</CardTitle>
        <CardDescription>{block.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          asChild
          className="border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/90 hover:via-rose-400/90 hover:to-orange-400/90"
        >
          <Link href={block.href}>{block.label}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
