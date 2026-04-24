"use client";

import { useState } from "react";

import { useBlogPosts } from "@/entities/blog";
import { DataState } from "@/shared/ui";
import { getVisiblePosts } from "../lib";
import { EmptyState } from "./empty-state";
import { Filters } from "./filters";
import { List } from "./list";

export function Blog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Все");
  const { data, isError } = useBlogPosts();
  const posts = data && !data.isEmpty ? data.data!.items : [];
  const categories = Array.from(new Set(posts.map((post) => post.category)));
  const featuredPost = posts.find((post) => post.featured);
  const visiblePostsByFilters = getVisiblePosts(posts, { query, category });
  const showFeatured = Boolean(featuredPost && !query && category === "Все");
  const visiblePosts = showFeatured
    ? posts.filter((post) => post.id !== featuredPost?.id)
    : visiblePostsByFilters;

  const resetFilters = () => {
    setQuery("");
    setCategory("Все");
  };

  if (isError) {
    return (
      <section className="container py-8 md:py-12">
        <DataState
          variant="error"
          title="Не удалось загрузить блог"
          description="Обновите страницу или попробуйте вернуться позже."
        />
      </section>
    );
  }

  if (!data) {
    return null;
  }

  if (data.isEmpty) {
    return (
      <section className="container py-8 md:py-12">
        <DataState
          title="Статьи пока не добавлены"
          description="Когда появятся публикации, они отобразятся здесь."
        />
      </section>
    );
  }

  return (
    <section className="container py-8 md:py-12" aria-labelledby="blog-content-title">
      <h2 id="blog-content-title" className="sr-only">
        Статьи блога
      </h2>

      <div className="mx-auto max-w-4xl space-y-8">
        <Filters
          categories={categories}
          query={query}
          category={category}
          onQueryChange={setQuery}
          onCategoryChange={setCategory}
        />

        {visiblePostsByFilters.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : (
          <List posts={visiblePosts} featuredPost={showFeatured ? featuredPost : undefined} />
        )}
      </div>
    </section>
  );
}
