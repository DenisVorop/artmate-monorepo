import { cache } from "react";
import { readContestLegalDocument } from "@/shared/actions/contests/legal-document";
import { routes } from "@/shared/constants";
export const buildContestLegalPage = cache(async (slug: string, id: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^[a-zA-Z0-9]{1,32}$/.test(id)) return null;
  const source = await readContestLegalDocument(slug, id);
  if (!source) return null;
  const href = routes.legal.contestConditions(slug, id);
  return {
    contentType: "pdf" as const,
    title: source.title,
    description: "Задание, сроки, выбор победителей и получение призов.",
    href,
    updatedAt: new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow" }).format(
      new Date(source.updatedAt),
    ),
    fileHref: `${href}/file`,
  };
});
