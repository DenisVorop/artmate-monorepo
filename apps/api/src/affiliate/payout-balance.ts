export type AffiliatePayoutBalance = {
  availableKopecks: number;
  reservedKopecks: number;
  paidKopecks: number;
  debtKopecks: number;
};

export function deriveAffiliatePayoutBalance(input: {
  grossAvailableKopecks: bigint;
  reservedKopecks: bigint;
  paidKopecks: bigint;
}): AffiliatePayoutBalance {
  for (const [label, value] of Object.entries(input)) {
    if (value < 0n) throw new RangeError(`${label} is negative`);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError(`${label} exceeds safe integer range`);
    }
  }
  const committed = input.paidKopecks + input.reservedKopecks;
  if (committed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Affiliate payout commitments exceed safe integer range");
  }
  const net = input.grossAvailableKopecks - committed;
  return {
    availableKopecks: Number(net > 0n ? net : 0n),
    reservedKopecks: Number(input.reservedKopecks),
    paidKopecks: Number(input.paidKopecks),
    debtKopecks: Number(net < 0n ? -net : 0n),
  };
}
