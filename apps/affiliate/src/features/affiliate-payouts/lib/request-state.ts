import type { CreateAffiliatePayoutInputDTO } from "@/shared/actions/affiliate";

export function getOrCreatePayoutAttempt(
  current: CreateAffiliatePayoutInputDTO | null,
  amountKopecks: number,
  createRequestId: () => string,
) {
  return (
    current ?? { amountKopecks, requestId: createRequestId() }
  ) satisfies CreateAffiliatePayoutInputDTO;
}

export function shouldRetainPayoutAttempt(status: number) {
  return status >= 500;
}
