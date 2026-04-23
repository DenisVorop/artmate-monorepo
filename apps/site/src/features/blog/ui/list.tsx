import { FeaturedPost, PostCard, type BlogPost } from "@/entities/blog";

type ListProps = {
  posts: BlogPost[];
  featuredPost?: BlogPost;
};

export function List({ posts, featuredPost }: ListProps) {
  return (
    <div className="space-y-8">
      {featuredPost && <FeaturedPost post={featuredPost} />}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
