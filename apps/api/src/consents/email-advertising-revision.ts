import { ConsentChecks } from "./consent-checks";
import type { Prisma } from "../generated/prisma/client";

/** The currently published advertising document/form; withdrawal never depends on it. */
export class EmailAdvertisingRevision {
  public static async current(
    tx: Prisma.TransactionClient,
  ): Promise<string | undefined> {
    const rows = await tx.consentRevision.findMany({
      where: {
        kind: "EMAIL_ADVERTISING",
        purpose: "site_auth",
        ...ConsentChecks.activeWhere(),
      },
      select: { id: true },
      take: 2,
    });
    return rows.length === 1 ? rows[0]!.id : undefined;
  }
}
