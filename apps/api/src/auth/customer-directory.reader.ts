import { Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import type { CustomerAuthDirectoryV1 } from "../users/contracts/auth-directory.contract";

@Injectable()
export class CustomerDirectoryReader {
  public async byEmail(
    tx: Prisma.TransactionClient,
    email: string,
  ): Promise<CustomerAuthDirectoryV1 | null> {
    const rows = await tx.$queryRaw<CustomerAuthDirectoryV1[]>`
      SELECT user_id AS "userId", email, name, phone, status::text AS status, auth_version AS "authVersion", email_verified_at AS "emailVerifiedAt", profile_revision AS "profileRevision", roles, image
      FROM customer_auth_directory_v1 WHERE email = ${email}`;
    return rows[0] ?? null;
  }

  public async byId(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<CustomerAuthDirectoryV1 | null> {
    const rows = await tx.$queryRaw<CustomerAuthDirectoryV1[]>`
      SELECT user_id AS "userId", email, name, phone, status::text AS status, auth_version AS "authVersion", email_verified_at AS "emailVerifiedAt", profile_revision AS "profileRevision", roles, image
      FROM customer_auth_directory_v1 WHERE user_id = ${userId}`;
    return rows[0] ?? null;
  }
}
