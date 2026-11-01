import { FeaturedPost, PostCard, type BlogPost } from "@/entities/blog";

type ListProps = {
  posts: BlogPost[];
  featuredPost?: BlogPost;
};

// The list sits inside max-w-4xl, with a 20px gap between cards.
const imageSizes =
  "(min-width: 64rem) calc(53.5rem / 3), (min-width: 48rem) 22.375rem, (min-width: 40rem) 18.375rem, calc(100vw - 2rem)";
const featuredImageSizes =
  "(min-width: 64rem) 28rem, (min-width: 48rem) 23rem, (min-width: 40rem) 38rem, calc(100vw - 2rem)";

export function List({ posts, featuredPost }: ListProps) {
  return (
    <div className="space-y-8">
      {featuredPost && <FeaturedPost post={featuredPost} imageSizes={featuredImageSizes} />}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            eagerImage={!featuredPost && index === 0}
            imageSizes={imageSizes}
          />
        ))}
      </div>
    </div>
  );
}
