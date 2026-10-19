import { randomUUID } from "node:crypto";

import type { Order, Prisma } from "../../generated/prisma/client";
import { OzonPostings } from "../../delivery-tracking/ozon-postings";

// Orders publishes its desired delivery configuration into the DB command channel.
// Must run under the order lock, in the same transaction as the source change.
export async function publishTrackingRequest(
  tx: Prisma.TransactionClient,
  order: Pick<
    Order,
    "id" | "deliveryProvider" | "crmStatus" | "paymentStatus" | "ozonPostings"
  >,
) {
  if (order.deliveryProvider !== "OZON") return;
  const ozonPostings = OzonPostings.parse(order.ozonPostings);
  const data = {
    revision: randomUUID(),
    provider: order.deliveryProvider,
    ozonPostings,
    enabled:
      order.crmStatus === "DELIVERING" &&
      order.paymentStatus === "PAID" &&
      ozonPostings.length > 0,
  };
  await tx.deliveryTrackingRequest.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, ...data },
    update: data,
  });
}
