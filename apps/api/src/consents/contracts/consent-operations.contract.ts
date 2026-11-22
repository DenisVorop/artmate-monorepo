import { createHash, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { Prisma, type ConsentKind } from "../../generated/prisma/client";
import type { RequestEvidenceV1 } from "../../common/request-evidence";
import { ConsentCommandPayload } from "./consent-command-payload";
import type { ConsentDecisionV1 } from "./consent-decision.contract";

export type ConsentObjectContext = {
  purpose: string;
  subjectId: string;
  contextKey: string;
  userId: string;
};
export type ConsentDocumentRegistration = {
  id: string;
  kind: ConsentKind;
  purpose: string;
  version: string;
  title: string;
  documentBase64: string;
  formBase64: string;
};
export type ConsentOperationIntent =
  | {
      contractVersion: 1;
      type: "REGISTER";
      document: ConsentDocumentRegistration;
    }
  | {
      contractVersion: 1;
      type: "OFFER";
      context: ConsentObjectContext;
      revisionIds: string[];
      validity: { years: number };
    }
  | {
      contractVersion: 1;
      type: "ACCEPT";
      context: ConsentObjectContext;
      offerId: string;
      decisions: ConsentDecisionV1[];
      individualPart: Prisma.InputJsonValue;
      evidence: RequestEvidenceV1;
    };
export type ConsentOfferPublication = ConsentObjectContext & {
  id: string;
  email: string;
  revisionIds: string[];
  startsAt: string;
  endsAt: string;
  validUntil: string;
  usedAt: string | null;
};
export type ConsentAcceptancePublication = {
  id: string;
  individualPart: Prisma.JsonValue;
  acceptedAt: Date;
  startsAt: Date;
  endsAt: Date;
  revision: {
    id: string;
    documentTitle: string;
    version: string;
    kind: string;
    documentSha256: string;
    formSha256: string;
  };
};
export type ConsentOperationResult =
  | { type: "REGISTER"; revisionId: string }
  | { type: "OFFER"; offer: ConsentOfferPublication }
  | {
      type: "ACCEPT";
      context: ConsentObjectContext;
      offerId: string;
      acceptanceIds: string[];
      startsAt: string;
      endsAt: string;
    };
export type ConsentOperationReceipt =
  | { status: "PENDING" }
  | { status: "REJECTED"; errorCode: string }
  | { status: "COMPLETED"; result: ConsentOperationResult };
type Reader = Pick<Prisma.TransactionClient, "$queryRaw">;

export class ConsentOperationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Published DB transport, never a call to a Consents business handler.
 * Producers only append immutable commands. Read methods use owner publications.
 * Waiting must happen AFTER the producer commits its local transaction. */
export class ConsentOperations {
  static async enqueue(
    tx: Prisma.TransactionClient,
    operationKey: string,
    intent: ConsentOperationIntent,
  ) {
    const payloadHash = ConsentCommandPayload.operationHash(intent);
    const row = await tx.applyConsentDecisionCommand.upsert({
      where: { operationKey },
      update: {},
      create: {
        kind: "CONTEXT",
        operationKey,
        intent: intent as unknown as Prisma.InputJsonValue,
        payloadHash,
        requestId: randomUUID(),
        requestContext:
          intent.type === "ACCEPT"
            ? (intent.evidence as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
      },
      select: { id: true, payloadHash: true },
    });
    if (row.payloadHash !== payloadHash)
      throw new ConsentOperationError("OPERATION_CONFLICT");
    return row.id;
  }
  static async enqueueRegistration(
    tx: Prisma.TransactionClient,
    input: Omit<
      ConsentDocumentRegistration,
      "id" | "documentBase64" | "formBase64"
    > & { document: Buffer; form: Prisma.InputJsonValue },
  ) {
    const key = JSON.stringify([input.kind, input.purpose, input.version]);
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM consent_revision_catalog_v1 WHERE kind = ${input.kind.toLowerCase()} AND purpose = ${input.purpose} AND version = ${input.version}`;
    const id =
      rows[0]?.id ??
      createHash("sha256").update(key).digest("hex").slice(0, 32);
    const { document, form, ...metadata } = input;
    const commandId = await this.enqueue(
      tx,
      `register:${createHash("sha256").update(key).digest("hex")}`,
      {
        contractVersion: 1,
        type: "REGISTER",
        document: {
          ...metadata,
          id,
          documentBase64: document.toString("base64"),
          formBase64: Buffer.from(JSON.stringify(form)).toString("base64"),
        },
      },
    );
    return { revisionId: id, commandId };
  }
  static async result(
    db: Reader,
    id: string,
  ): Promise<ConsentOperationReceipt | null> {
    const rows = await db.$queryRaw<
      {
        status: "pending" | "completed" | "rejected";
        result: ConsentOperationResult | null;
        errorCode: string | null;
      }[]
    >`SELECT status, result, error_code AS "errorCode" FROM consent_operation_results_v1 WHERE id = ${id}`;
    const row = rows[0];
    if (!row) return null;
    if (row.status === "completed" && row.result)
      return { status: "COMPLETED", result: row.result };
    return row.status === "rejected"
      ? { status: "REJECTED", errorCode: row.errorCode! }
      : { status: "PENDING" };
  }
  static async wait(
    db: Reader,
    id: string,
    timeoutMs = 15_000,
  ): Promise<ConsentOperationResult> {
    const until = Date.now() + timeoutMs;
    do {
      const receipt = await this.result(db, id);
      if (receipt?.status === "COMPLETED") return receipt.result;
      if (receipt?.status === "REJECTED")
        throw new ConsentOperationError(receipt.errorCode);
      await setTimeout(75);
    } while (Date.now() < until);
    throw new ConsentOperationError("PROCESSING");
  }
  static async offer(db: Reader, id: string, context: ConsentObjectContext) {
    const rows = await db.$queryRaw<
      { publication: ConsentOfferPublication }[]
    >`SELECT publication FROM consent_object_offers_v1
      WHERE id = ${id} AND purpose = ${context.purpose} AND subject_id = ${context.subjectId}
      AND context_key = ${context.contextKey} AND user_id = ${context.userId}`;
    return rows[0]?.publication ?? null;
  }
  static async acceptances(
    db: Reader,
    ids: string[],
  ): Promise<ConsentAcceptancePublication[]> {
    if (!ids.length) return [];
    return db.$queryRaw<
      ConsentAcceptancePublication[]
    >`SELECT id, individual_part AS "individualPart", accepted_at AS "acceptedAt",
      starts_at AS "startsAt", ends_at AS "endsAt", revision FROM consent_object_acceptances_v1 WHERE id IN (${Prisma.join(ids)})`;
  }
}
