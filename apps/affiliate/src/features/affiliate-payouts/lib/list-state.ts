export function getPayoutTotalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function getPayoutDisplayState<T>(
  lastSuccessfulSummary: T | undefined,
  currentData: { summary: T } | undefined,
) {
  return {
    isSummaryFresh: currentData !== undefined,
    summary: currentData?.summary ?? lastSuccessfulSummary,
  };
}
