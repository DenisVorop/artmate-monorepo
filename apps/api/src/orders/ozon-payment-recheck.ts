export const ozonPaymentRecheckMaxAttempts = 12;
export const ozonPaymentRecheckLeaseMs = 60_000;

const ozonPaymentRecheckDelaysMs = [
  5_000, 15_000, 30_000, 60_000, 120_000, 300_000,
];

export function ozonPaymentRecheckDelayMs(attempts: number) {
  const index = Math.max(
    0,
    Math.min(attempts, ozonPaymentRecheckDelaysMs.length - 1),
  );

  return ozonPaymentRecheckDelaysMs[index]!;
}

export type OzonPaymentRecheckLease = {
  orderId: string;
  leaseToken: string;
};

export const ozonPaymentRecheckRetryableStatuses = new Set([
  "STATUS_UNSPECIFIED",
  "STATUS_NEW",
  "STATUS_PAYMENT_PENDING",
  "STATUS_AUTHORIZED",
]);
