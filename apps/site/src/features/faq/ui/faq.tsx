"use client";

import { useMemo, useState } from "react";

import { getVisibleFaqSections } from "../lib";
import { EmptyState } from "./empty-state";
import { Filters } from "./filters";
import { HelpCard } from "./help-card";
import { List } from "./list";

export function Faq() {
  const [query, setQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const sections = useMemo(
    () => getVisibleFaqSections({ query, activeSectionId }),
    [activeSectionId, query],
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
          query={query}
          activeSectionId={activeSectionId}
          onQueryChange={handleQueryChange}
          onSectionChange={setActiveSectionId}
        />

        {sections.length > 0 ? (
          <List sections={sections} />
        ) : (
          <EmptyState query={query} onReset={() => handleQueryChange("")} />
        )}

        <HelpCard />
      </div>
    </section>
  );
}
