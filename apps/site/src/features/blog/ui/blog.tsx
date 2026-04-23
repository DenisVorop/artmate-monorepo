"use client";

import { useMemo, useState } from "react";

import { BLOG_POSTS, getFeaturedPost } from "@/entities/blog";
import { getVisiblePosts } from "../lib";
import { EmptyState } from "./empty-state";
import { Filters } from "./filters";
import { List } from "./list";

export function Blog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Все");
  const featuredPost = getFeaturedPost();
  const posts = useMemo(() => getVisiblePosts({ query, category }), [category, query]);
  const showFeatured = Boolean(featuredPost && !query && category === "Все");
  const visiblePosts = showFeatured
    ? BLOG_POSTS.filter((post) => post.id !== featuredPost?.id)
    : posts;

  const resetFilters = () => {
    setQuery("");
    setCategory("Все");
  };

  return (
    <section className="container py-8 md:py-12" aria-labelledby="blog-content-title">
      <h2 id="blog-content-title" className="sr-only">
        Статьи блога
      </h2>

      <div className="mx-auto max-w-4xl space-y-8">
        <Filters
          query={query}
          category={category}
          onQueryChange={setQuery}
          onCategoryChange={setCategory}
        />

        {posts.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : (
          <List posts={visiblePosts} featuredPost={showFeatured ? featuredPost : undefined} />
        )}
      </div>
    </section>
  );
}
