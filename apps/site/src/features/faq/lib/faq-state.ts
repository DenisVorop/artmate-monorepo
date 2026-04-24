import {
  BookOpen,
  CreditCard,
  Palette,
  RefreshCw,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";

import type { FaqItem as FaqItemDTO, FaqSection as FaqSectionDTO } from "@/entities/faq";

export type FaqItem = FaqItemDTO;

export type FaqSection = FaqSectionDTO & {
  icon: LucideIcon;
  tone: string;
};

const FAQ_SECTION_DECOR: Record<string, Pick<FaqSection, "icon" | "tone">> = {
  order: {
    icon: ShoppingBag,
    tone: "bg-rose-50 text-rose-600 ring-rose-200/70",
  },
  delivery: {
    icon: Truck,
    tone: "bg-sky-50 text-sky-600 ring-sky-200/70",
  },
  return: {
    icon: RefreshCw,
    tone: "bg-amber-50 text-amber-700 ring-amber-200/70",
  },
  product: {
    icon: BookOpen,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  },
  coloring: {
    icon: Palette,
    tone: "bg-violet-50 text-violet-700 ring-violet-200/70",
  },
  promocodes: {
    icon: CreditCard,
    tone: "bg-pink-50 text-pink-700 ring-pink-200/70",
  },
};

const DEFAULT_SECTION_DECOR = {
  icon: BookOpen,
  tone: "bg-muted text-foreground ring-border",
} satisfies Pick<FaqSection, "icon" | "tone">;

export function decorateFaqSections(sections: FaqSectionDTO[]): FaqSection[] {
  return sections.map((section) => ({
    ...section,
    ...(FAQ_SECTION_DECOR[section.id] ?? DEFAULT_SECTION_DECOR),
  }));
}

export function getVisibleFaqSections({
  sections,
  query,
  activeSectionId,
}: {
  sections: FaqSection[];
  query: string;
  activeSectionId?: string | null;
}) {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery) {
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(normalizedQuery) ||
            item.answer.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }

  if (activeSectionId) {
    return sections.filter((section) => section.id === activeSectionId);
  }

  return sections;
}
