import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  EnsureCustomerProfileCommand,
  Prisma,
} from "../generated/prisma/client";
import { CustomerProfileValues } from "./contracts/customer-profile-values";
import { ProfileCommandPayload } from "./contracts/profile-command-payload";
import { UsersService } from "./users.service";

/** One local Users transaction applies the intent AND its durable receipt.
 * Row locks fence competing workers; there is no network work inside a claim. */
@Injectable()
export class CustomerProfileCommandHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  public async process(commandId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM ensure_customer_profile_commands
        WHERE id = ${commandId} AND status = 'pending' AND available_at <= (clock_timestamp() AT TIME ZONE 'UTC')
          AND (locked_until IS NULL OR locked_until <= (clock_timestamp() AT TIME ZONE 'UTC'))
        FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return false;
      const command = await tx.ensureCustomerProfileCommand.findUniqueOrThrow({
        where: { id: commandId },
      });
      const result = await this._apply(tx, command);
      await tx.ensureCustomerProfileCommand.update({
        where: { id: command.id },
        data: {
          attempts: { increment: 1 },
          leaseToken: null,
          lockedUntil: null,
          processedAt: new Date(),
          ...(result.errorCode
            ? { status: "REJECTED", errorCode: result.errorCode }
            : {
                status: "COMPLETED",
                resultUserId: result.userId!,
                resultProfileRevision: result.revision!,
              }),
        },
      });
      return true;
    });
  }

  private async _apply(
    tx: Prisma.TransactionClient,
    command: EnsureCustomerProfileCommand,
  ): Promise<{ errorCode?: string; userId?: string; revision?: number }> {
    if (
      command.contractVersion !== 1 ||
      command.payloadHash !==
        ProfileCommandPayload.hash({ ...command, contractVersion: 1 })
    )
      return { errorCode: "INVALID_PAYLOAD" };
    if (
      !CustomerProfileValues.validName(command.name) ||
      !CustomerProfileValues.validPhone(command.phone)
    )
      return { errorCode: "INVALID_PROFILE" };
    // Read only Auth's published operation/proof provenance, never its account
    // secrets, password drafts, capabilities or mutable orchestration state.
    const operations = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM auth_completion_operations WHERE id = ${command.operationId} FOR SHARE`;
    if (!operations.length) return { errorCode: "INVALID_OPERATION" };
    const operation = await tx.authCompletionOperation.findUniqueOrThrow({
      where: { id: command.operationId },
      select: {
        status: true,
        identityFactId: true,
        authentication: { select: { userIdSnapshot: true, authVersion: true } },
      },
    });
    if (
      operation.status !== "PENDING" ||
      operation.identityFactId !== command.identityFactId ||
      operation.authentication.userIdSnapshot !== command.expectedUserId
    )
      return { errorCode: "INVALID_OPERATION" };
    const proof = await tx.verifiedIdentityFact.findUnique({
      where: { id: command.identityFactId },
      select: {
        email: true,
        verifiedAt: true,
        userIdSnapshot: true,
      },
    });
    if (
      !proof ||
      (proof.userIdSnapshot !== null &&
        proof.userIdSnapshot !== command.expectedUserId)
    )
      return { errorCode: "INVALID_PROOF" };
    const lockKey = `customer-profile:${proof.email}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const userRows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM users WHERE email = ${proof.email} FOR UPDATE`;
    let user = userRows[0]
      ? await tx.user.findUniqueOrThrow({ where: { id: userRows[0].id } })
      : null;
    if ((user?.id ?? null) !== command.expectedUserId)
      return { errorCode: "ACCOUNT_CHANGED" };
    if (
      user &&
      (user.status !== "ACTIVE" ||
        user.authVersion !== operation.authentication.authVersion)
    )
      return { errorCode: "ACCOUNT_UNAVAILABLE" };
    if (user) {
      const profile = await tx.customerProfileState.findUnique({
        where: { userId: user.id },
      });
      if (!profile) return { errorCode: "PROFILE_UNAVAILABLE" };
      if (profile.revision !== command.expectedProfileRevision)
        return { errorCode: "PROFILE_CHANGED" };
      const name = CustomerProfileValues.validName(user.name)
        ? undefined
        : CustomerProfileValues.normalizeName(command.name);
      const phone = CustomerProfileValues.validPhone(user.phone)
        ? undefined
        : CustomerProfileValues.normalizePhone(command.phone);
      if (
        name !== undefined ||
        phone !== undefined ||
        user.emailVerifiedAt === null
      ) {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name,
            phone,
            emailVerifiedAt: user.emailVerifiedAt ?? proof.verifiedAt,
          },
        });
      }
    } else {
      user = await tx.user.create({
        data: {
          email: proof.email,
          emailVerifiedAt: proof.verifiedAt,
          name: CustomerProfileValues.normalizeName(command.name),
          phone: CustomerProfileValues.normalizePhone(command.phone),
          roles: this.users.getDefaultPrismaRoles(),
        },
      });
    }
    const state = await tx.customerProfileState.findUniqueOrThrow({
      where: { userId: user.id },
    });
    return { userId: user.id, revision: state.revision };
  }
}
