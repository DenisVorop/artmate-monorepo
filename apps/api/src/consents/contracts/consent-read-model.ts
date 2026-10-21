import { RecipientConsentLock } from "./recipient-consent-lock";
import type { Prisma } from "../../generated/prisma/client";
import type {
  RequiredConsentStateV1,
  UserConsentStateV1,
} from "./consent-decision.contract";

export interface ConsentDocumentV1 {
  readonly revisionId: string;
  readonly version: string;
  readonly documentTitle: string;
  readonly documentSha256: string;
  readonly formSha256: string;
  readonly url: string;
}

export interface ConsentReadinessV1 {
  readonly contractVersion: 1;
  readonly purpose: string;
  readonly personalData: ConsentDocumentV1;
  readonly emailAdvertising: ConsentDocumentV1;
  readonly state: UserConsentStateV1;
  readonly requiredAccepted: boolean;
  readonly advertisingAccepted: boolean;
  readonly needsStep: boolean;
}

interface ConsentReadRow {
  registry:
    | (Omit<ConsentDocumentV1, "url"> & {
        kind: "personal_data" | "email_advertising";
      })[]
    | null;
  stateRevision: number | null;
  requiredAcceptances: RequiredConsentStateV1[] | null;
  subscriptionId: string | null;
  advertisingState: string | null;
  advertisingVersion: number | null;
  activeGrantId: string | null;
  advertisingRevisionId: string | null;
  recipientKey: string | null;
  keyVersion: string | null;
}

/** Consents' published exact-email read model. No business-service calls and no
 * mutation of another domain. Registry and permission come from one SQL snapshot. */
export class ConsentReadModel {
  public static async read(
    tx: Prisma.TransactionClient,
    email: string,
    purpose: string,
  ): Promise<ConsentReadinessV1 | null> {
    if (purpose !== "site_auth") return null;
    const rows = await tx.$queryRaw<ConsentReadRow[]>`SELECT
      (SELECT jsonb_agg(jsonb_build_object('revisionId', r.id, 'kind', r.kind,
        'version', r.version, 'documentTitle', r.document_title,
        'documentSha256', r.document_sha256, 'formSha256', r.form_sha256))
        FROM consent_revisions r WHERE r.purpose = ${purpose}
          AND r.published_at <= (clock_timestamp() AT TIME ZONE 'UTC')
          AND (r.retired_at IS NULL OR r.retired_at > (clock_timestamp() AT TIME ZONE 'UTC'))) AS registry,
      c.revision AS "stateRevision", c.required_acceptances AS "requiredAcceptances",
      s.id AS "subscriptionId", s.state::text AS "advertisingState", s.version AS "advertisingVersion",
      s.active_grant_id AS "activeGrantId", e.revision_id AS "advertisingRevisionId",
      s.recipient_key AS "recipientKey", s.key_version AS "keyVersion"
      FROM (SELECT ${email}::text AS email) subject
      LEFT JOIN user_consent_states c ON c.email = subject.email
      LEFT JOIN email_advertising_subscriptions s ON s.email = subject.email
      LEFT JOIN email_advertising_consent_events e ON e.id = s.active_grant_id AND e.subscription_id = s.id`;
    const row = rows[0];
    const personalData = row?.registry?.filter(
      (item) => item.kind === "personal_data",
    );
    const emailAdvertising = row?.registry?.filter(
      (item) => item.kind === "email_advertising",
    );
    if (!row || personalData?.length !== 1 || emailAdvertising?.length !== 1)
      return null;
    const requiredAcceptances = row.requiredAcceptances ?? [];
    const requiredAccepted = requiredAcceptances.some(
      (acceptance) =>
        acceptance.purpose === purpose &&
        acceptance.revisionId === personalData[0]!.revisionId,
    );
    const advertising =
      row.advertisingState === "active" &&
      row.subscriptionId &&
      row.activeGrantId &&
      row.advertisingRevisionId &&
      row.recipientKey &&
      row.keyVersion
        ? {
            state: "ACTIVE" as const,
            version: row.advertisingVersion!,
            subscriptionId: row.subscriptionId,
            activeGrantId: row.activeGrantId,
            revisionId: row.advertisingRevisionId,
            recipientKey: row.recipientKey,
            keyVersion: row.keyVersion,
          }
        : {
            state: "REVOKED" as const,
            version: row.advertisingVersion ?? 0,
            subscriptionId: row.subscriptionId,
          };
    const advertisingAccepted =
      advertising.state === "ACTIVE" &&
      advertising.revisionId === emailAdvertising[0]!.revisionId;
    return {
      contractVersion: 1,
      purpose,
      personalData: {
        ...personalData[0]!,
        url: "/legal/personal-data-consent",
      },
      emailAdvertising: {
        ...emailAdvertising[0]!,
        url: "/legal/advertising-consent",
      },
      state: {
        contractVersion: 1,
        email,
        revision: row.stateRevision ?? 0,
        requiredAcceptances,
        advertising,
      },
      requiredAccepted,
      advertisingAccepted,
      needsStep: !requiredAccepted || !advertisingAccepted,
    };
  }

  /** Exact persisted acceptance behind the current published permission. A
   * projection or browser boolean alone is not business-action provenance. */
  public static async requiredAcceptance(
    tx: Prisma.TransactionClient,
    readiness: ConsentReadinessV1,
    actorUserId: string,
  ): Promise<{ id: string; revisionId: string } | null> {
    if (!readiness.requiredAccepted) return null;
    const acceptance = readiness.state.requiredAcceptances.find(
      (value) =>
        value.purpose === readiness.purpose &&
        value.revisionId === readiness.personalData.revisionId,
    );
    if (!acceptance) return null;
    return tx.requiredConsentAcceptance.findFirst({
      where: {
        id: acceptance.acceptanceId,
        email: readiness.state.email,
        revisionId: readiness.personalData.revisionId,
        purpose: readiness.purpose,
        OR: [
          { actorUserIdSnapshot: null },
          { actorUserIdSnapshot: actorUserId },
        ],
      },
      select: { id: true, revisionId: true },
    });
  }

  /** Published operation result used to fence a grant against a later revoke.
   * Absence means this operation made no advertising permission change. */
  public static async grantForOperation(
    tx: Prisma.TransactionClient,
    operationId: string,
  ): Promise<{ id: string; version: number } | null> {
    return tx.emailAdvertisingConsentEvent.findFirst({
      where: { authOperationId: operationId, action: "GRANTED" },
      select: { id: true, version: true },
    });
  }

  /** SHARE fences registry INSERT/UPDATE as well as existing revisions: a new
   * published row cannot appear between this read and the final Auth commit.
   * Registry readers remain compatible. Acquire it before the recipient locks;
   * retain the transaction through the final version check/commit. */
  public static async lock(
    tx: Prisma.TransactionClient,
    email: string,
    purpose: string,
  ): Promise<ConsentReadinessV1 | null> {
    await tx.$executeRaw`LOCK TABLE consent_revisions IN SHARE MODE`;
    await RecipientConsentLock.acquire(tx, email);
    return this.read(tx, email, purpose);
  }
}
