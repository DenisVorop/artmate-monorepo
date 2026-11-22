import { Prisma } from "../generated/prisma/client";
import type { ConsentDecisionV1 } from "./contracts/consent-decision.contract";

/** Shared invariants for Auth, object consents and advertising settings. */
export class ConsentChecks {
  static decisions(input: Prisma.JsonValue): ConsentDecisionV1[] | null {
    if (!Array.isArray(input)) return null;
    const result: ConsentDecisionV1[] = [];
    for (const item of input) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        Object.keys(item).length !== 2 ||
        typeof item.revisionId !== "string" ||
        !item.revisionId ||
        typeof item.accepted !== "boolean" ||
        result.some((decision) => decision.revisionId === item.revisionId)
      )
        return null;
      result.push({ revisionId: item.revisionId, accepted: item.accepted });
    }
    return result;
  }
  static revisionsMatch(
    decisions: readonly ConsentDecisionV1[],
    revisionIds: readonly string[],
  ) {
    return decisions.every((decision) =>
      revisionIds.includes(decision.revisionId),
    );
  }
  static allAccepted(
    decisions: readonly ConsentDecisionV1[],
    revisionIds: readonly string[],
  ) {
    return (
      decisions.length === revisionIds.length &&
      new Set(decisions.map((decision) => decision.revisionId)).size ===
        decisions.length &&
      new Set(revisionIds).size === revisionIds.length &&
      this.revisionsMatch(decisions, revisionIds) &&
      decisions.every((decision) => decision.accepted)
    );
  }
  static verified(
    identity: { email: string | null; verifiedAt: Date | null },
    now = new Date(),
  ) {
    return Boolean(
      identity.email?.trim() &&
      identity.verifiedAt &&
      Number.isFinite(identity.verifiedAt.getTime()) &&
      identity.verifiedAt <= now,
    );
  }
  static async lockRegistry(tx: Prisma.TransactionClient) {
    await tx.$executeRaw`LOCK TABLE consent_revisions IN SHARE MODE`;
  }
  static activeWhere(now = new Date()): Prisma.ConsentRevisionWhereInput {
    return {
      publishedAt: { lte: now },
      OR: [{ retiredAt: null }, { retiredAt: { gt: now } }],
    };
  }
  static activeSql() {
    return Prisma.sql`r.published_at <= (clock_timestamp() AT TIME ZONE 'UTC') AND (r.retired_at IS NULL OR r.retired_at > (clock_timestamp() AT TIME ZONE 'UTC'))`;
  }
  static period(startsAt: Date, validity: { years: number }) {
    if (
      !Number.isInteger(validity.years) ||
      validity.years < 1 ||
      validity.years > 100
    )
      return null;
    const endsAt = new Date(startsAt);
    endsAt.setUTCFullYear(endsAt.getUTCFullYear() + validity.years);
    // Calendar anniversaries of February 29 fall on the last day of February.
    if (endsAt.getUTCMonth() !== startsAt.getUTCMonth()) endsAt.setUTCDate(0);
    return { startsAt, endsAt };
  }
}
