import { BlogPost } from "@/features/blog-post";

type BlogPostPageProps = {
  slug: string;
};

export function BlogPostPage(props: BlogPostPageProps) {
  return <BlogPost {...props} />;
}
