import type { Prisma } from "../../generated/prisma/client";

/** Shared recipient serialization protocol, independent from registry and keys. */
export class RecipientConsentLock {
  public static async acquire(
    tx: Prisma.TransactionClient,
    email: string,
  ): Promise<void> {
    const key = `consents:${email}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    await tx.$queryRaw`SELECT email FROM user_consent_states WHERE email = ${email} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM email_advertising_subscriptions WHERE email = ${email} FOR UPDATE`;
  }
}
