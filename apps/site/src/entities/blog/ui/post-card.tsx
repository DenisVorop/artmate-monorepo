import { ArrowRight, Clock, Tag } from "lucide-react";
import Image from "next/image";

import type { BlogPost } from "../model";
import {
  AspectRatio,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
  routes,
} from "@/shared";
import { Link } from "@/shared/ui/link";

type PostCardProps = {
  post: BlogPost;
};

export function PostCard({ post }: PostCardProps) {
  return (
    <Card className="group/blog-post h-full gap-0 py-0 transition-shadow hover:shadow-md">
      <Link href={routes.blogPost(post.id)} className="block overflow-hidden bg-muted">
        <AspectRatio ratio={16 / 10} className="relative">
          <Image
            fill
            src={post.image}
            alt={post.title}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover/blog-post:scale-105"
          />
        </AspectRatio>
      </Link>

      <CardContent className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Tag className="size-3" />
            {post.category}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {post.readTime}
          </span>
        </div>

        <CardTitle className="text-lg leading-snug">
          <Link
            href={routes.blogPost(post.id)}
            className="text-foreground transition-colors hover:text-rose-500"
          >
            {post.title}
          </Link>
        </CardTitle>

        <CardDescription className="line-clamp-3">{post.excerpt}</CardDescription>
      </CardContent>

      <CardFooter className="mt-auto justify-between gap-3 border-t-0 bg-transparent px-4 pt-0 pb-4">
        <span className="text-xs text-muted-foreground">{post.date}</span>
        <Link
          href={routes.blogPost(post.id)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground transition-colors hover:text-rose-500 group-hover/blog-post:text-rose-500"
        >
          Читать
          <ArrowRight className="size-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
