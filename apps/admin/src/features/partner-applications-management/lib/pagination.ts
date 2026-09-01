export function clampPartnerApplicationsPage(
  currentPage: number,
  totalPages: number,
) {
  const lastAvailablePage = Math.max(1, Math.floor(totalPages));
  const normalizedCurrentPage = Math.max(1, Math.floor(currentPage));

  return Math.min(normalizedCurrentPage, lastAvailablePage);
}
