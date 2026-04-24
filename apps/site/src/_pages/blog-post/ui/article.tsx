import Image from "next/image";
import { ArrowLeft, Quote, Share2, Tag } from "lucide-react";

import type { BlogArticleContent, BlogPost } from "@/entities/blog";
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
  const shareUrl = getAbsoluteUrl(routes.blogPost(post.id));

  return (
    <article id={articleId} className="space-y-8">
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-base leading-7 text-muted-foreground md:text-lg">{post.excerpt}</p>
        </CardContent>
      </Card>

      <div className="space-y-10">
        {content.sections.map((section, index) => (
          <section key={section.id} id={section.id} className="scroll-mt-24 space-y-5">
            {index > 0 ? <Separator /> : null}

            <div className="space-y-4">
              <SectionTitle className="text-foreground">{section.heading}</SectionTitle>

              {section.paragraphs ? (
                <div className="space-y-4">
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    <p
                      key={`${section.id}-${paragraphIndex}`}
                      className="text-base leading-7 text-muted-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            {section.image ? (
              <Card className="overflow-hidden py-0">
                <figure>
                  <AspectRatio ratio={16 / 9} className="relative bg-muted">
                    <Image
                      fill
                      src={section.image.src}
                      alt={section.image.alt}
                      sizes="(min-width: 1280px) 720px, (min-width: 768px) 80vw, 100vw"
                      className="object-cover"
                    />
                  </AspectRatio>
                  {section.image.caption ? (
                    <figcaption className="border-t px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                      {section.image.caption}
                    </figcaption>
                  ) : null}
                </figure>
              </Card>
            ) : null}

            {section.quote ? (
              <Card className="bg-rose-50/60 ring-rose-200">
                <CardContent className="pt-6">
                  <Quote className="mb-3 size-5 text-rose-500" />
                  <blockquote className="space-y-3">
                    <p className="text-base leading-7 text-foreground italic">
                      {section.quote.text}
                    </p>
                    <cite className="text-sm text-muted-foreground not-italic">
                      {section.quote.author}
                    </cite>
                  </blockquote>
                </CardContent>
              </Card>
            ) : null}

            {section.highlights ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {section.highlights.map((item) => (
                  <Card key={item.title} size="sm">
                    <CardContent className="pt-4">
                      <div className="flex gap-3">
                        <span className="text-2xl leading-none">{item.emoji}</span>
                        <div className="space-y-1.5">
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            {section.tips ? (
              <div className="space-y-3">
                {section.tips.map((tip) => (
                  <Card key={tip.step} size="sm">
                    <CardContent className="pt-4">
                      <div className="flex gap-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 via-rose-400 to-orange-400 font-semibold text-white shadow-sm shadow-rose-500/20">
                          {tip.step}
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-medium text-foreground">{tip.title}</p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {tip.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
          </section>
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
