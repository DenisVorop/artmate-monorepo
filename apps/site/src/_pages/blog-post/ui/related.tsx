import type { BlogPost } from "@/entities/blog";
import { PostCard } from "@/entities/blog";
import { Button } from "@/shared/ui";
import { routes } from "@/shared/constants";
import { Link } from "@/shared/ui/link";
import { SectionSubtitle, SectionTitle } from "@/shared/ui/typography";

type RelatedProps = {
  posts: BlogPost[];
};

export function Related({ posts }: RelatedProps) {
  return (
    <section aria-labelledby="related-posts-title" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <SectionTitle id="related-posts-title" className="text-foreground">
            Похожие статьи
          </SectionTitle>
          <SectionSubtitle className="text-muted-foreground">
            Материалы по соседним темам, которые помогут закрепить подход на практике.
          </SectionSubtitle>
        </div>

        <Button asChild variant="outline">
          <Link href={routes.blog}>Все статьи</Link>
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
