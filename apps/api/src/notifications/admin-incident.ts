import type { Prisma } from "../generated/prisma/client";
import {
  publishAdminNotice,
  type AdminNoticeCommandV1,
} from "./contracts/admin-notice-command.contract";

/** Call under the monitor transaction/lock. The state transition and notification
 * commit together, so replicas and restarts do not create repeated incident jobs.
 */
export async function updateAdminIncident(
  tx: Prisma.TransactionClient,
  key: string,
  problem: Omit<AdminNoticeCommandV1, "kind" | "contractVersion"> | null,
  recovery: Omit<AdminNoticeCommandV1, "kind" | "contractVersion">,
) {
  const incident = await tx.adminNotificationIncident.upsert({
    where: { key },
    create: { key },
    update: {},
  });
  if (incident.active === Boolean(problem)) return;

  await tx.adminNotificationIncident.update({
    where: { key },
    data: { active: Boolean(problem), openedAt: problem ? new Date() : null },
  });
  await publishAdminNotice(tx, problem ?? recovery);
}
