import type { Metadata } from "next";

import type { BlogPost } from "@/entities/blog";
import { routes, siteConfig } from "@/shared";

export function getBlogPostMetadata(post: BlogPost): Metadata {
  const title = `${post.title} - Блог Artmate`;
  const url = routes.blogPost(post.id);

  return {
    title: {
      absolute: title,
    },
    description: post.excerpt,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description: post.excerpt,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "article",
      images: [
        {
          url: post.image,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: post.excerpt,
      images: [post.image],
    },
  };
}
