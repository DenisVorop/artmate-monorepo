import { ArrowRight, Clock } from "lucide-react";
import Image from "next/image";

import type { BlogPost } from "../model";
import { AspectRatio, Badge, Button, Card, CardContent, CardDescription, CardTitle } from "@/shared/ui";
import { routes } from "@/shared/constants";
import { Link } from "@/shared/ui/link";

type FeaturedPostProps = {
  post: BlogPost;
};

export function FeaturedPost({ post }: FeaturedPostProps) {
  return (
    <Card className="grid gap-0 overflow-hidden py-0 md:grid-cols-2">
      <Link href={routes.blogPost(post.slug)} className="block bg-muted">
        <AspectRatio ratio={16 / 10} className="relative h-full md:aspect-auto">
          <Image
            fill
            priority
            src={post.image}
            alt={post.title}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </AspectRatio>
      </Link>

      <CardContent className="flex flex-col justify-center gap-5 p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-rose-500 text-white">Новая</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {post.readTime}
          </span>
        </div>

        <div className="space-y-3">
          <CardTitle className="text-2xl leading-tight md:text-3xl">
            <Link href={routes.blogPost(post.slug)} className="hover:text-rose-500">
              {post.title}
            </Link>
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">{post.excerpt}</CardDescription>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">{post.date}</span>
          <Button asChild variant="outline">
            <Link href={routes.blogPost(post.slug)}>
              Читать статью
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
