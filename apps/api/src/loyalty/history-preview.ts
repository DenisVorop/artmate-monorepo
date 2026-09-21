import {
  purchasePointsForAmount,
  purchaseRateForSpend,
  purchaseRulesVersion,
} from "./purchase-rules";

export type HistoricalPurchase = {
  id: string;
  createdAt: Date;
  paidAt: Date | null;
  completedAt: Date | null;
  paid: boolean;
  status: string;
  cashKopecks: bigint;
  spentPoints: boolean;
  ratePercent: number | null;
  rateVersion: string | null;
  accountRatePercent?: number;
  refunds: Array<{ at: Date; cashKopecks: bigint }>;
  transitions: Array<{ at: Date; from: string | null; to: string }>;
  accounted: boolean;
};

export type PurchaseHistoryIssue = { orderId: string; reason: string };
export type PurchaseHistoryEntry = {
  orderId: string;
  ratePercent: number;
  rateSource: "checkout" | "historical";
  spendBeforeCheckoutKopecks: string;
  netRewardPoints: number;
  proposedCreditPoints: number;
  accounted: boolean;
};

const statuses = new Set([
  "new",
  "in_progress",
  "waiting_payment",
  "paid",
  "delivering",
  "completed",
  "cancelled",
]);
const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
const validDate = (value: Date) =>
  value instanceof Date && Number.isFinite(value.getTime());

/** Read-only proposal. Incomplete evidence never becomes a payable total. */
export function previewPurchaseHistory(
  orders: HistoricalPurchase[],
  sourceIssues: PurchaseHistoryIssue[] = [],
) {
  const issues = [...sourceIssues];
  const valid: HistoricalPurchase[] = [];
  const ids = new Set<string>();
  for (const order of orders) {
    const badDate =
      !validDate(order.createdAt) ||
      (order.paidAt !== null &&
        (!validDate(order.paidAt) || order.paidAt < order.createdAt)) ||
      (order.completedAt !== null &&
        (!validDate(order.completedAt) || order.completedAt < order.createdAt));
    const badFacts =
      badDate ||
      !order.id ||
      ids.has(order.id) ||
      !statuses.has(order.status) ||
      order.cashKopecks < 0n ||
      order.cashKopecks > maxSafe ||
      (order.paid && !order.paidAt) ||
      (!order.paid && order.paidAt !== null) ||
      (order.status === "completed" && !order.completedAt) ||
      (order.ratePercent === null) !== (order.rateVersion === null) ||
      (order.accountRatePercent !== undefined &&
        (!order.accounted ||
          ![3, 5, 7, 10].includes(order.accountRatePercent) ||
          (order.ratePercent !== null &&
            order.ratePercent !== order.accountRatePercent))) ||
      (order.ratePercent !== null &&
        (![3, 5, 7, 10].includes(order.ratePercent) ||
          order.rateVersion !== purchaseRulesVersion));
    ids.add(order.id);
    const refunds = order.refunds.reduce(
      (total, refund) => total + refund.cashKopecks,
      0n,
    );
    const badRefund =
      order.refunds.some(
        (refund) =>
          !validDate(refund.at) ||
          refund.at < order.createdAt ||
          !order.paidAt ||
          refund.at < order.paidAt ||
          refund.cashKopecks < 0n,
      ) || refunds > order.cashKopecks;
    const transitions = [...order.transitions].sort(
      (a, b) => a.at.getTime() - b.at.getTime(),
    );
    const badHistory =
      transitions.some(
        (event, index) =>
          !validDate(event.at) ||
          event.at < order.createdAt ||
          (event.from === null
            ? index !== 0 || event.to !== "waiting_payment"
            : !statuses.has(event.from)) ||
          !statuses.has(event.to) ||
          (index > 0 &&
            (transitions[index - 1]!.at.getTime() === event.at.getTime() ||
              transitions[index - 1]!.to !== event.from)),
      ) ||
      (transitions.length > 0 && transitions.at(-1)!.to !== order.status) ||
      (order.completedAt !== null &&
        order.status !== "completed" &&
        !transitions.some(
          (event) =>
            event.at >= order.completedAt! && event.from === "completed",
        ));
    if (badFacts || badRefund || badHistory) {
      issues.push({
        orderId: order.id,
        reason: badFacts
          ? "invalid_order_facts"
          : badRefund
            ? "invalid_refund_facts"
            : "incomplete_status_history",
      });
    } else valid.push({ ...order, transitions });
  }

  const entries: PurchaseHistoryEntry[] = [];
  for (const order of valid.sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  )) {
    if (!order.paid || order.status !== "completed") continue;
    let spend = 0n;
    for (const previous of valid) {
      if (
        previous.id === order.id ||
        !previous.paidAt ||
        !previous.completedAt ||
        previous.paidAt >= order.createdAt ||
        previous.completedAt >= order.createdAt
      )
        continue;
      // completedAt records the first completion. Later CRM transitions can end it.
      let status = "completed";
      for (const event of previous.transitions) {
        if (event.at >= previous.completedAt && event.at < order.createdAt)
          status = event.to;
      }
      if (status !== "completed") continue;
      const refundsBeforeCheckout = previous.refunds.reduce(
        (total, refund) =>
          refund.at < order.createdAt ? total + refund.cashKopecks : total,
        0n,
      );
      spend += previous.cashKopecks - refundsBeforeCheckout;
    }
    const rate =
      order.ratePercent ??
      order.accountRatePercent ??
      purchaseRateForSpend(spend);
    const netCash =
      order.cashKopecks -
      order.refunds.reduce((total, refund) => total + refund.cashKopecks, 0n);
    const points = order.spentPoints
      ? 0n
      : purchasePointsForAmount(netCash, rate);
    entries.push({
      orderId: order.id,
      ratePercent: rate,
      rateSource: order.ratePercent === null ? "historical" : "checkout",
      spendBeforeCheckoutKopecks: String(spend),
      netRewardPoints: Number(points),
      proposedCreditPoints: order.accounted ? 0 : Number(points),
      accounted: order.accounted,
    });
  }
  const total = entries.reduce(
    (sum, entry) => sum + BigInt(entry.proposedCreditPoints),
    0n,
  );
  if (total > maxSafe)
    issues.push({ orderId: "", reason: "credit_total_exceeds_safe_range" });
  return {
    rulesVersion: "purchase-history-v1" as const,
    scope: "purchases" as const,
    complete: issues.length === 0,
    proposedCreditPoints: issues.length === 0 ? Number(total) : null,
    entries,
    issues,
  };
}
