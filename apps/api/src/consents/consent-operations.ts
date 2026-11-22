import { createHash, randomBytes } from "node:crypto";
import { ConsentKind, Prisma } from "../generated/prisma/client";
import { CustomerAuthSubjectLock } from "../users/contracts/customer-auth-subject-lock";
import { ConsentChecks } from "./consent-checks";
import {
  ConsentOperationError,
  type ConsentObjectContext,
  type ConsentOperationIntent,
  type ConsentOperationResult,
  type ConsentOfferPublication,
} from "./contracts/consent-operations.contract";

function fail(code: string): never {
  throw new ConsentOperationError(code);
}
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function nonempty(value: unknown, max: number): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}
function validContext(value: unknown): value is ConsentObjectContext {
  return (
    object(value) &&
    nonempty(value.purpose, 80) &&
    nonempty(value.subjectId, 80) &&
    nonempty(value.contextKey, 80) &&
    nonempty(value.userId, 128)
  );
}
function ids(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 50 &&
    value.every((id) => nonempty(id, 128)) &&
    new Set(value).size === value.length
  );
}

/** Internal implementation of the ONE Consents command handler. No imports from
 * consuming domains and no exported Nest provider for other modules to call. */
export async function applyConsentOperation(
  tx: Prisma.TransactionClient,
  raw: Prisma.JsonValue,
  requestId: string,
): Promise<ConsentOperationResult> {
  if (!object(raw) || raw.contractVersion !== 1) fail("INVALID_PAYLOAD");
  if (raw.type === "REGISTER") {
    const document = raw.document;
    if (
      !object(document) ||
      !nonempty(document.id, 128) ||
      !Object.values(ConsentKind).includes(document.kind as ConsentKind) ||
      !nonempty(document.purpose, 80) ||
      !nonempty(document.version, 64) ||
      !nonempty(document.title, 255) ||
      typeof document.documentBase64 !== "string" ||
      typeof document.formBase64 !== "string"
    )
      fail("INVALID_PAYLOAD");
    const bytes = Buffer.from(document.documentBase64, "base64");
    if (!bytes.length || bytes.toString("base64") !== document.documentBase64)
      fail("INVALID_PAYLOAD");
    const form = Buffer.from(document.formBase64, "base64");
    if (!form.length || form.toString("base64") !== document.formBase64)
      fail("INVALID_PAYLOAD");
    try {
      if (!object(JSON.parse(form.toString("utf8")))) fail("INVALID_PAYLOAD");
    } catch {
      fail("INVALID_PAYLOAD");
    }
    const documentSha256 = createHash("sha256").update(bytes).digest("hex");
    const formSha256 = createHash("sha256").update(form).digest("hex");
    const key = {
      kind: document.kind as ConsentKind,
      purpose: document.purpose,
      version: document.version,
    };
    const registeredAt = new Date();
    const revision = await tx.consentRevision.upsert({
      where: { kind_purpose_version: key },
      update: {},
      create: {
        id: document.id,
        ...key,
        documentTitle: document.title,
        documentBytes: new Uint8Array(bytes),
        documentSha256,
        formSnapshotBytes: new Uint8Array(form),
        formSha256,
        createdAt: registeredAt,
        publishedAt: registeredAt,
      },
    });
    if (
      revision.id !== document.id ||
      revision.documentSha256 !== documentSha256 ||
      revision.formSha256 !== formSha256 ||
      revision.retiredAt ||
      !revision.publishedAt
    )
      fail("REVISION_CONFLICT");
    return { type: "REGISTER", revisionId: revision.id };
  }
  if (!validContext(raw.context)) fail("INVALID_PAYLOAD");
  const context = raw.context;
  await CustomerAuthSubjectLock.acquire(tx, context.userId);
  const identities = await tx.$queryRaw<
    { email: string | null; verifiedAt: Date | null; status: string }[]
  >`SELECT email, email_verified_at AS "verifiedAt", status::text AS status FROM customer_auth_directory_v1 WHERE user_id = ${context.userId}`;
  const identity = identities[0];
  const now = new Date();
  if (
    !identity ||
    identity.status !== "active" ||
    !ConsentChecks.verified(identity, now)
  )
    fail("INVALID_PROOF");
  await ConsentChecks.lockRegistry(tx);
  if (raw.type === "OFFER") {
    if (
      !ids(raw.revisionIds) ||
      !object(raw.validity) ||
      typeof raw.validity.years !== "number"
    )
      fail("INVALID_PAYLOAD");
    const period = ConsentChecks.period(now, { years: raw.validity.years });
    if (!period) fail("INVALID_VALIDITY");
    await assertRevisions(tx, raw.revisionIds, now);
    await tx.contextualConsentOffer.deleteMany({
      where: { userId: context.userId, validUntil: { lt: now } },
    });
    const offer = await tx.contextualConsentOffer.create({
      data: {
        id: randomBytes(16).toString("hex"),
        ...context,
        email: identity.email!,
        revisionIds: raw.revisionIds,
        ...period,
        validUntil: new Date(now.getTime() + 30 * 60_000),
      },
    });
    const publication: ConsentOfferPublication = {
      ...context,
      id: offer.id,
      email: offer.email,
      revisionIds: offer.revisionIds,
      startsAt: offer.startsAt.toISOString(),
      endsAt: offer.endsAt.toISOString(),
      validUntil: offer.validUntil.toISOString(),
      usedAt: null,
    };
    return { type: "OFFER", offer: publication };
  }
  if (
    raw.type !== "ACCEPT" ||
    !nonempty(raw.offerId, 32) ||
    !object(raw.individualPart) ||
    !object(raw.evidence)
  )
    fail("INVALID_PAYLOAD");
  const intent = raw as unknown as Extract<
    ConsentOperationIntent,
    { type: "ACCEPT" }
  >;
  const decisions = ConsentChecks.decisions(raw.decisions as Prisma.JsonValue);
  if (!decisions) fail("INVALID_PAYLOAD");
  await tx.$queryRaw`SELECT id FROM contextual_consent_offers WHERE id = ${intent.offerId} FOR UPDATE`;
  const offer = await tx.contextualConsentOffer.findUnique({
    where: { id: intent.offerId },
  });
  if (
    !offer ||
    offer.usedAt ||
    offer.validUntil <= now ||
    offer.userId !== context.userId ||
    offer.purpose !== context.purpose ||
    offer.subjectId !== context.subjectId ||
    offer.contextKey !== context.contextKey
  )
    fail("OFFER_CHANGED");
  if (offer.email !== identity.email) fail("IDENTITY_CHANGED");
  if (!ConsentChecks.allAccepted(decisions, offer.revisionIds))
    fail("REQUIRED_CONSENT_MISSING");
  await assertRevisions(tx, offer.revisionIds, now);
  await tx.contextualConsentOffer.update({
    where: { id: offer.id },
    data: { usedAt: now },
  });
  const acceptanceIds: string[] = [];
  for (const revisionId of offer.revisionIds) {
    const record = await tx.contextualConsentAcceptance.create({
      data: {
        offerId: offer.id,
        actorUserIdSnapshot: context.userId,
        email: offer.email,
        emailVerifiedAtSnapshot: identity.verifiedAt!,
        revisionId,
        purpose: context.purpose,
        subjectId: context.subjectId,
        contextKey: context.contextKey,
        individualPart: intent.individualPart,
        requestId,
        requestContext: intent.evidence as unknown as Prisma.InputJsonValue,
        acceptedAt: now,
        startsAt: offer.startsAt,
        endsAt: offer.endsAt,
      },
      select: { id: true },
    });
    acceptanceIds.push(record.id);
  }
  return {
    type: "ACCEPT",
    context,
    offerId: offer.id,
    acceptanceIds,
    startsAt: offer.startsAt.toISOString(),
    endsAt: offer.endsAt.toISOString(),
  };
}
async function assertRevisions(
  tx: Prisma.TransactionClient,
  revisionIds: string[],
  now: Date,
) {
  const count = await tx.consentRevision.count({
    where: { id: { in: revisionIds }, ...ConsentChecks.activeWhere(now) },
  });
  if (count !== revisionIds.length) fail("CONSENT_REVISION_CHANGED");
}
