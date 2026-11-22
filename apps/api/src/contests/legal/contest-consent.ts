import { ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  ConsentOperations,
  type ConsentOfferPublication,
} from "../../consents/contracts/consent-operations.contract";
import { registerContestConsentDocuments } from "./contest-legal-documents";
import { CustomerAuthSubjectLock } from "../../users/contracts/customer-auth-subject-lock";
import { throwContestConsentError } from "./contest-consent-errors";
import { Prisma, type Contest } from "../../generated/prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RequestEvidenceV1 } from "../../common/request-evidence";
import type { SubmitContestEntryDTO } from "../dto/contest-entry-request.dto";
import {
  basePublicationRestriction,
  conditionsHref,
  contestPublicationPolicy,
  type CommonLegalDocument,
} from "./contest-legal.constants";
export const entryConsentContext = (contest: Contest, userId: string) => ({
  purpose: "contest_entry",
  subjectId: contest.id,
  contextKey: contest.legalDocumentId ?? "",
  userId,
});
export async function prepareContestConsent(
  db: PrismaService,
  slug: string,
  userId: string,
) {
  const contest = await db.contest.findFirst({
    where: { slug, published: true },
  });
  if (!contest || !contest.legalDocumentId)
    throw new ConflictException("Условия конкурса ещё не опубликованы");
  if (new Date() < contest.opensAt || new Date() >= contest.closesAt)
    throw new ConflictException("Приём работ закрыт");
  const document = await db.contestLegalDocument.findUniqueOrThrow({
    where: { id: contest.legalDocumentId },
  });
  const { common, registrationCommandIds } = await db.$transaction((tx) =>
    registerContestConsentDocuments(
      tx,
      contest.id,
      document.contestVersion,
      document.commonDocuments as unknown as CommonLegalDocument[],
      Buffer.from(document.pdf),
    ),
  );
  await Promise.all(
    registrationCommandIds.map((id) => ConsentOperations.wait(db, id)),
  ).catch((error) => throwContestConsentError(error));
  const commandId = await db.$transaction((tx) =>
    ConsentOperations.enqueue(tx, `offer:${randomUUID()}`, {
      contractVersion: 1,
      type: "OFFER",
      context: entryConsentContext(contest, userId),
      revisionIds: common.map((item) => item.revisionId),
      validity: { years: 15 },
    }),
  );
  const result = await ConsentOperations.wait(db, commandId).catch((error) =>
    throwContestConsentError(error),
  );
  if (result.type !== "OFFER")
    throw new ConflictException("Не удалось подготовить документы");
  const offer = result.offer;
  return {
    id: offer.id,
    validUntil: offer.validUntil,
    conditions: {
      id: document.id,
      title: document.title,
      sha256: document.sha256,
      href: conditionsHref(slug, document.id),
    },
    documents: common.map(
      ({ id, version, title, href, fileHref, sha256, revisionId }) => ({
        id,
        version,
        title,
        href,
        fileHref,
        sha256,
        revisionId,
      }),
    ),
  };
}
export async function assertContestConsentOffer(
  db: Pick<Prisma.TransactionClient, "$queryRaw">,
  contest: Contest,
  userId: string,
  input: SubmitContestEntryDTO,
) {
  const offer = await ConsentOperations.offer(
    db,
    input.consentOfferId,
    entryConsentContext(contest, userId),
  );
  if (!offer)
    throw new ConflictException(
      "Подтверждения устарели. Обновите документы в форме",
    );
  const revisions = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM consent_revision_catalog_v1
    WHERE id IN (${Prisma.join(offer.revisionIds)}) AND version LIKE '%:form3'`;
  if (revisions.length !== offer.revisionIds.length)
    throw new ConflictException(
      "Подтверждения устарели. Обновите документы в форме",
    );
  return offer;
}
export async function enqueueContestAcceptance(
  tx: Prisma.TransactionClient,
  contest: Contest,
  userId: string,
  input: SubmitContestEntryDTO,
  offer: ConsentOfferPublication,
  photo: { checksum: string },
  revisionId: string,
  evidence: RequestEvidenceV1,
) {
  await CustomerAuthSubjectLock.acquire(tx, userId);
  const [profile] = await tx.$queryRaw<
    {
      name: string | null;
      email: string | null;
      phone: string | null;
      profileRevision: number | null;
    }[]
  >`SELECT name, email, phone, profile_revision AS "profileRevision"
    FROM customer_auth_directory_v1 WHERE user_id = ${userId}`;
  if (!profile || profile.email !== offer.email)
    throw new ConflictException(
      "Данные аккаунта изменились. Обновите документы в форме",
    );
  const publication = {
    publicName: profile.name,
    ...contestPublicationPolicy,
    restriction: basePublicationRestriction,
    values: {
      caption: input.caption,
      number: input.number ?? null,
    },
  };
  const individual = {
    actor: { userId, ...profile },
    contestId: contest.id,
    contestTitle: contest.title,
    revisionId,
    object: {
      photoSha256: photo.checksum,
      caption: input.caption,
      albumId: input.albumId,
      number: input.number ?? null,
    },
    conditionsId: contest.legalDocumentId,
    confirmations: {
      rules: {
        accepted: true,
        method: "submit",
        buttonLabel: "Отправить работу",
      },
      personalData: input.personalDataAccepted,
      dissemination: input.publicationAccepted,
    },
    publication,
  };
  const commandId = await ConsentOperations.enqueue(tx, `accept:${offer.id}`, {
    contractVersion: 1,
    type: "ACCEPT",
    context: entryConsentContext(contest, userId),
    offerId: offer.id,
    decisions: offer.revisionIds.map((revisionId) => ({
      revisionId,
      accepted: input.personalDataAccepted && input.publicationAccepted,
    })),
    individualPart: individual as unknown as Prisma.InputJsonValue,
    evidence,
  });
  return {
    commandId,
    publication: publication as unknown as Prisma.InputJsonValue,
  };
}
export type EntryLegalAcceptance = {
  actor: {
    userId: string;
    name: string | null;
    email: string;
    phone: string | null;
    profileRevision: number | null;
  };
  conditionsId: string;
  publication: {
    publicName: string | null;
    fields: string[];
    resources: { id: string; label: string; urls: string[] }[];
    restriction: string;
  };
};
