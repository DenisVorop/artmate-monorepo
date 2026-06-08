import type { CatalogLandingPage } from "../model";

const statusLabels: Record<CatalogLandingPage["status"], string> = {
  archived: "Архив",
  draft: "Черновик",
  published: "Опубликована",
};

const productSourceLabels: Record<CatalogLandingPage["productSource"], string> = {
  manual: "Вручную",
  mixed: "Теги + вручную",
  tags: "По тегам",
};

export function getCatalogLandingStatusLabel(status: CatalogLandingPage["status"]) {
  return statusLabels[status];
}

export function getCatalogLandingProductSourceLabel(source: CatalogLandingPage["productSource"]) {
  return productSourceLabels[source];
}

export function getCatalogLandingHref(slug: string) {
  return `/catalog/podborki/${slug}`;
}
