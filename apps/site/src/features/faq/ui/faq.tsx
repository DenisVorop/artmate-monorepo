"use client";

import { useMemo, useState } from "react";

import { useFaqSections } from "@/entities/faq";

import { decorateFaqSections, getVisibleFaqSections } from "../lib";
import { EmptyState } from "./empty-state";
import { Filters } from "./filters";
import { HelpCard } from "./help-card";
import { List } from "./list";

export function Faq() {
  const [query, setQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const { sections: faqSections } = useFaqSections();
  const sections = useMemo(() => decorateFaqSections(faqSections), [faqSections]);
  const visibleSections = useMemo(
    () => getVisibleFaqSections({ sections, query, activeSectionId }),
    [activeSectionId, query, sections],
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActiveSectionId(null);
  };

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
