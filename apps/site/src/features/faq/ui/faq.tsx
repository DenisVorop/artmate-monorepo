"use client";

import { useState } from "react";

import { useFaqSections } from "@/entities/faq";
import { DataState } from "@/shared/ui";

import { decorateFaqSections, getVisibleFaqSections } from "../lib";
import { EmptyState } from "./empty-state";
import { Filters } from "./filters";
import { HelpCard } from "./help-card";
import { List } from "./list";

export function Faq() {
  const [query, setQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const { data, isError } = useFaqSections();
  const faqSections = data && !data.isEmpty ? data.data!.items : [];
  const sections = decorateFaqSections(faqSections);
  const visibleSections = getVisibleFaqSections({ sections, query, activeSectionId });

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActiveSectionId(null);
  };

  if (isError) {
    return (
      <section className="container py-8 md:py-12">
        <DataState
          variant="error"
          title="Не удалось загрузить вопросы"
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
          title="Вопросы пока не добавлены"
          description="Когда появятся разделы FAQ, они отобразятся здесь."
        />
      </section>
    );
  }

  return (
    <section className="container py-8 md:py-12" aria-labelledby="faq-content-title">
      <h2 id="faq-content-title" className="sr-only">
        Список вопросов и&nbsp;ответов
      </h2>

      <div className="mx-auto max-w-4xl space-y-8">
        <Filters
          sections={sections}
          query={query}
          activeSectionId={activeSectionId}
          onQueryChange={handleQueryChange}
          onSectionChange={setActiveSectionId}
        />

        {visibleSections.length > 0 ? (
          <List sections={visibleSections} />
        ) : (
          <EmptyState query={query} onReset={() => handleQueryChange("")} />
        )}

        <HelpCard />
      </div>
    </section>
  );
}
