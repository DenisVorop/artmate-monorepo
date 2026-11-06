import { PostCard, type BlogPost } from "@/entities/blog";
import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { SectionTitle } from "@/shared/ui/typography";

type RelatedProps = {
  posts: BlogPost[];
  slug: string;
};

export function Related({ posts, slug }: RelatedProps) {
  const titleId = `related-posts-${slug}`;

  return (
    <section
      data-related-articles={slug}
      aria-labelledby={posts.length ? titleId : undefined}
      className="space-y-6 border-t pt-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {posts.length ? (
          <SectionTitle id={titleId} className="text-foreground">
            Похожие статьи
          </SectionTitle>
        ) : null}
        <Button asChild variant="outline" className="w-fit shrink-0">
          <Link href={routes.blog}>Все статьи блога</Link>
        </Button>
      </div>
      {posts.length ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {posts.map((post) => (
            <PostCard
              key={post.slug}
              post={post}
              imageSizes="(min-width: 1024px) 342px, (min-width: 640px) 50vw, 100vw"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
