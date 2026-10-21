import { UnauthorizedException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import type { CustomerAuthDirectoryV1 } from "../users/contracts/auth-directory.contract";

/** Auth reuses a real Users confirmation without manufacturing a fresh date.
 * Serialize the published fact for concurrent methods/accounts of one email. */
export class RecordedEmailProof {
  public static async resolve(
    tx: Prisma.TransactionClient,
    user: CustomerAuthDirectoryV1,
    context: RequestEvidenceV1,
  ) {
    if (!user.email || !user.emailVerifiedAt)
      throw new UnauthorizedException("Email confirmation is required");
    const key = `auth-recorded-email:${user.email}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const existing = await tx.verifiedIdentityFact.findFirst({
      where: {
        email: user.email,
        OR: [{ userIdSnapshot: null }, { userIdSnapshot: user.userId }],
      },
      orderBy: { verifiedAt: "desc" },
    });
    return (
      existing ??
      tx.verifiedIdentityFact.create({
        data: {
          email: user.email,
          method: "RECORDED_EMAIL_VERIFICATION",
          sourceId: `users:${user.userId}:${user.emailVerifiedAt.toISOString()}`,
          userIdSnapshot: user.userId,
          verifiedAt: user.emailVerifiedAt,
          requestContext: context as unknown as Prisma.InputJsonValue,
        },
      })
    );
  }
}
