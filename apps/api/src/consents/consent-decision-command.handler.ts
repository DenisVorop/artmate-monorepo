import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ApplyConsentDecisionCommand,
  Prisma,
} from "../generated/prisma/client";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import { ConsentCommandPayload } from "./contracts/consent-command-payload";
import type { AdvertisingConsentDevice } from "./contracts/consent-decision.contract";
import { EmailAdvertisingGrant } from "./email-advertising-grant";
import { ConsentChecks } from "./consent-checks";
import { applyConsentOperation } from "./consent-operations";
import {
  ConsentOperationError,
  type ConsentOperationResult,
} from "./contracts/consent-operations.contract";
import { ConsentReadModel } from "./contracts/consent-read-model";

/** The receipt, immutable facts and authoritative permission commit in one local
 * Consents transaction. A command enqueue alone never grants permission. */
@Injectable()
export class ConsentDecisionCommandHandler {
  constructor(private readonly prisma: PrismaService) {}

  public async process(commandId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM apply_consent_decision_commands
        WHERE id = ${commandId} AND status = 'pending'
          AND available_at <= (clock_timestamp() AT TIME ZONE 'UTC')
          AND (locked_until IS NULL OR locked_until <= (clock_timestamp() AT TIME ZONE 'UTC')) FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return false;
      const command = await tx.applyConsentDecisionCommand.findUniqueOrThrow({
        where: { id: commandId },
      });
      let result: {
        errorCode?: string;
        revision?: number;
        operationResult?: ConsentOperationResult;
      };
      if (command.kind === "CONTEXT") {
        if (
          !command.intent ||
          command.payloadHash !==
            ConsentCommandPayload.operationHash(command.intent)
        )
          result = { errorCode: "INVALID_PAYLOAD" };
        else {
          try {
            result = {
              operationResult: await applyConsentOperation(
                tx,
                command.intent,
                command.requestId,
              ),
            };
          } catch (error) {
            if (error instanceof ConsentOperationError)
              result = { errorCode: error.code };
            else throw error;
          }
        }
      } else if (
        command.kind !== "AUTH" ||
        !command.operationId ||
        !command.identityFactId ||
        !command.requestContext
      )
        result = { errorCode: "INVALID_PAYLOAD" };
      else
        result = await this._apply(
          tx,
          command as ApplyConsentDecisionCommand & {
            operationId: string;
            identityFactId: string;
            requestContext: Prisma.JsonValue;
          },
        );
      await tx.applyConsentDecisionCommand.update({
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
                ...(result.operationResult
                  ? {
                      result:
                        result.operationResult as unknown as Prisma.InputJsonValue,
                    }
                  : { resultStateRevision: result.revision! }),
              }),
        },
      });
      return true;
    });
  }

  private async _apply(
    tx: Prisma.TransactionClient,
    command: ApplyConsentDecisionCommand & {
      operationId: string;
      identityFactId: string;
      requestContext: Prisma.JsonValue;
    },
  ): Promise<{ errorCode?: string; revision?: number }> {
    const decisions = ConsentChecks.decisions(command.decisions);
    const requestContext =
      command.requestContext as unknown as RequestEvidenceV1;
    const advertisingDevice = (command.advertisingDevice ?? undefined) as
      | AdvertisingConsentDevice
      | undefined;
    if (
      !decisions ||
      command.contractVersion !== 1 ||
      command.payloadHash !==
        ConsentCommandPayload.hash({
          ...command,
          contractVersion: 1,
          decisions,
          source: command.source ?? undefined,
          requestContext,
          advertisingDevice,
        })
    )
      return { errorCode: "INVALID_PAYLOAD" };
    const operations = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM auth_completion_operations WHERE id = ${command.operationId} FOR SHARE`;
    if (!operations.length) return { errorCode: "INVALID_OPERATION" };
    const operation = await tx.authCompletionOperation.findUniqueOrThrow({
      where: { id: command.operationId },
      select: {
        status: true,
        identityFactId: true,
        purpose: true,
        authentication: { select: { userIdSnapshot: true } },
      },
    });
    if (
      operation.status !== "PENDING" ||
      operation.identityFactId !== command.identityFactId
    )
      return { errorCode: "INVALID_OPERATION" };
    const proof = await tx.verifiedIdentityFact.findUnique({
      where: { id: command.identityFactId },
      select: { email: true, userIdSnapshot: true, verifiedAt: true },
    });
    if (
      !proof ||
      !ConsentChecks.verified({
        email: proof.email,
        verifiedAt: proof.verifiedAt,
      }) ||
      (proof.userIdSnapshot !== null &&
        proof.userIdSnapshot !== operation.authentication.userIdSnapshot)
    )
      return { errorCode: "INVALID_PROOF" };
    const current = await ConsentReadModel.lock(
      tx,
      proof.email,
      operation.purpose,
    );
    if (!current) return { errorCode: "CONSENT_REGISTRY_UNAVAILABLE" };
    if (
      current.state.revision !== command.expectedStateRevision ||
      current.state.advertising.version !== command.expectedAdvertisingVersion
    )
      return { errorCode: "CONSENTS_CHANGED" };
    if (
      !ConsentChecks.revisionsMatch(decisions, [
        current.personalData.revisionId,
        current.emailAdvertising.revisionId,
      ])
    )
      return { errorCode: "CONSENT_REVISION_CHANGED" };
    const personalData = decisions.find(
      (decision) => decision.revisionId === current.personalData.revisionId,
    );
    const advertising = decisions.find(
      (decision) => decision.revisionId === current.emailAdvertising.revisionId,
    );
    if (
      personalData?.accepted === false ||
      (!current.requiredAccepted && personalData?.accepted !== true)
    )
      return { errorCode: "REQUIRED_CONSENT_MISSING" };
    // Empty is Auth's automatic ready check. It cannot bypass an unresolved gate.
    if (!decisions.length && current.needsStep)
      return { errorCode: "CONSENTS_REQUIRED" };
    const acceptRequired =
      personalData?.accepted === true && !current.requiredAccepted;
    const grantAdvertising =
      advertising?.accepted === true && !current.advertisingAccepted;
    const occurredAt = new Date();
    const evidence = {
      identityFactId: command.identityFactId,
      actorUserIdSnapshot: operation.authentication.userIdSnapshot,
      email: proof.email,
      source: command.source,
      requestId: command.requestId,
      requestContext: command.requestContext as Prisma.InputJsonValue,
    };
    const acceptances = [...current.state.requiredAcceptances];
    if (acceptRequired) {
      const acceptance = await tx.requiredConsentAcceptance.create({
        data: {
          ...evidence,
          operationId: command.operationId,
          revisionId: current.personalData.revisionId,
          purpose: operation.purpose,
          acceptedAt: occurredAt,
        },
      });
      const previous = acceptances.findIndex(
        (item) => item.purpose === operation.purpose,
      );
      const next = {
        purpose: operation.purpose,
        revisionId: acceptance.revisionId,
        acceptanceId: acceptance.id,
      };
      if (previous < 0) acceptances.push(next);
      else acceptances[previous] = next;
    }
    if (grantAdvertising) {
      await EmailAdvertisingGrant.apply(tx, {
        ...evidence,
        requestContext,
        advertisingDevice,
        authOperationId: command.operationId,
        revisionId: current.emailAdvertising.revisionId,
        operationKey: crypto
          .createHash("sha256")
          .update(`consent-grant:${command.operationId}`)
          .digest("hex"),
        payloadHash: command.payloadHash,
        occurredAt,
      });
    }
    // false means no permission decision. It neither grants nor revokes an
    // earlier grant, and it creates no advertising event or subscription row.
    if (acceptRequired || grantAdvertising) {
      const revision = current.state.revision + 1;
      await tx.userConsentState.upsert({
        where: { email: proof.email },
        create: {
          email: proof.email,
          revision,
          requiredAcceptances: acceptances as unknown as Prisma.InputJsonValue,
        },
        update: {
          revision,
          requiredAcceptances: acceptances as unknown as Prisma.InputJsonValue,
        },
      });
      return { revision };
    }
    if (current.state.revision < 1)
      return { errorCode: "CONSENT_STATE_UNAVAILABLE" };
    return { revision: current.state.revision };
  }
}
