"use client";

import type { BlogArticleContent } from "@/entities/blog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui";
import { TableOfContents } from "./table-of-contents";
import { useContentsState } from "../lib/use-contents-state";

type NavigationProps = { content: BlogArticleContent; slug: string };

export function Navigation({ content, slug }: NavigationProps) {
  const { items, expanded, setExpanded, close } = useContentsState(content, slug);
  if (items.length < 2) return null;

  return (
    <aside
      data-article-navigation
      className="sticky top-[calc(var(--article-sticky-top)-1px)] z-10 min-w-0 bg-background lg:static lg:z-auto lg:flex lg:min-h-0 lg:flex-col"
    >
      <Card size="sm" className="hidden min-h-0 lg:flex">
        <CardHeader className="shrink-0 border-b">
          <CardTitle>Содержание</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 [scrollbar-width:thin] overflow-y-auto overscroll-contain pt-4">
          <TableOfContents items={items} />
        </CardContent>
      </Card>
      <Card data-mobile-article-contents size="sm" className="relative overflow-visible lg:hidden">
        <CardContent>
          <Accordion type="single" collapsible value={expanded} onValueChange={setExpanded}>
            <AccordionItem value="contents">
              <AccordionTrigger className="min-h-12 font-heading font-medium">
                Содержание
              </AccordionTrigger>
              <AccordionContent
                style={{ animation: "none", position: "absolute", left: 0, right: 0, top: "100%" }}
                className="max-h-[calc(100dvh-var(--article-sticky-top)-6rem)] overflow-y-auto overscroll-contain rounded-xl border bg-card p-3 shadow-sm [&_a]:no-underline"
              >
                <TableOfContents items={items} onNavigate={close} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </aside>
  );
}
