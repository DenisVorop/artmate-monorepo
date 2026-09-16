const selectionPageSize = 25;
const maxSelectionPages = 10_000;

type SelectionPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export async function collectAffiliatePartnerSelection<T>(
  fetchPage: (params: {
    page: number;
    pageSize: number;
  }) => Promise<SelectionPage<T>>,
) {
  const items: T[] = [];
  const seenPages = new Set<number>();
  let requestedPage = 1;
  let totalPages = 1;

  do {
    const response = await fetchPage({
      page: requestedPage,
      pageSize: selectionPageSize,
    });

    if (seenPages.has(response.page)) {
      break;
    }

    seenPages.add(response.page);
    items.push(...response.items);
    const actualPageSize =
      Number.isSafeInteger(response.pageSize) && response.pageSize > 0
        ? response.pageSize
        : selectionPageSize;
    totalPages = Math.min(
      maxSelectionPages,
      Math.max(1, Math.ceil(response.total / actualPageSize)),
    );
    requestedPage += 1;
  } while (requestedPage <= totalPages);

  return items;
}
