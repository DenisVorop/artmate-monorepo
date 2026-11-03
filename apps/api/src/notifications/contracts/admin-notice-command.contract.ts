import {
  NotificationJobChannel,
  type Prisma,
} from "../../generated/prisma/client";

/** Notifications inbox command. The producer saves it in the transaction that
 * records the event. Telegram credentials and chat routing belong to delivery.
 */
export type AdminNoticeCommandV1 = {
  kind: "admin_notice";
  contractVersion: 1;
  title: string;
  lines: string[];
  adminPath: string;
  actionLabel: string;
};

export async function publishAdminNotice(
  writer: Pick<Prisma.TransactionClient, "notificationJob">,
  input: Omit<AdminNoticeCommandV1, "kind" | "contractVersion">,
  id?: string,
) {
  const command: AdminNoticeCommandV1 = {
    kind: "admin_notice",
    contractVersion: 1,
    ...input,
  };
  await writer.notificationJob.create({
    data: {
      ...(id ? { id } : {}),
      channel: NotificationJobChannel.TELEGRAM,
      maxAttempts: 5,
      payload: command,
    },
  });
}
