import { randomUUID } from "node:crypto";

import type { Order, Prisma } from "../../generated/prisma/client";

// Orders publishes its desired delivery configuration into the DB command channel.
// Must run under the order lock, in the same transaction as the source change.
export async function publishTrackingRequest(
  tx: Prisma.TransactionClient,
  order: Pick<
    Order,
    | "id"
    | "deliveryProvider"
    | "crmStatus"
    | "paymentStatus"
    | "ozonPostingNumbers"
  >,
) {
  if (order.deliveryProvider !== "OZON") return;
  const data = {
    revision: randomUUID(),
    provider: order.deliveryProvider,
    externalNumbers: order.ozonPostingNumbers,
    enabled:
      order.crmStatus === "DELIVERING" &&
      order.paymentStatus === "PAID" &&
      order.ozonPostingNumbers.length > 0,
  };
  await tx.deliveryTrackingRequest.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, ...data },
    update: data,
  });
}
