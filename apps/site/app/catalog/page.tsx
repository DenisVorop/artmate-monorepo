import { CatalogPage } from "@/pages/catalog";
import { resolveInitialCategoryId, type SearchParams } from "@/features/catalog";

export { metadata } from "@/pages/catalog";

type CatalogRouteProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function Page({ searchParams }: CatalogRouteProps) {
  const initialCategoryId = resolveInitialCategoryId(await searchParams);

  return <CatalogPage initialCategoryId={initialCategoryId} />;
}
