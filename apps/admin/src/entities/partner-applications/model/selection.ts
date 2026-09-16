const initialSelectionPageSize = 100;
const maxSelectionPages = 10_000;

type SelectionPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function collectPartnerApplicationSelection<T>(
  fetchPage: (params: {
    page: number;
    pageSize: number;
  }) => Promise<SelectionPage<T>>,
) {
  const items: T[] = [];
  const seenPages = new Set<number>();
  let requestedPage = 1;
  let pageSize = initialSelectionPageSize;
  let totalPages = 1;

  do {
    const response = await fetchPage({ page: requestedPage, pageSize });

    if (seenPages.has(response.page)) {
      break;
    }

    seenPages.add(response.page);
    items.push(...response.items);
    pageSize =
      Number.isSafeInteger(response.pageSize) && response.pageSize > 0
        ? response.pageSize
        : pageSize;
    totalPages = Math.min(
      maxSelectionPages,
      Number.isSafeInteger(response.totalPages) && response.totalPages > 0
        ? response.totalPages
        : Math.max(1, Math.ceil(response.total / pageSize)),
    );
    requestedPage += 1;
  } while (requestedPage <= totalPages);

  return items;
}
