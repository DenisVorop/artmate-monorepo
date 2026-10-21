import type { Prisma } from "../../generated/prisma/client";

/** Users-owned read lock publication. Serializes email/status/verification
 * changes without allowing consumers to update Users or read its private rows. */
export class CustomerAuthSubjectLock {
  public static async acquire(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT 1::int AS locked FROM _lock_customer_auth_subject_v1(${userId})`;
  }
}
