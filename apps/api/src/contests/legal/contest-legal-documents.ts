import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { BadRequestException } from "@nestjs/common";
import { Prisma, type Contest } from "../../generated/prisma/client";
import { ConsentOperations } from "../../consents/contracts/consent-operations.contract";
import type { PrismaService } from "../../prisma/prisma.service";
import { buildContestConditions, legalReadiness } from "./contest-conditions";
import {
  conditionsHref,
  contestLegalPacket,
  legalAssets,
  contestPublicationPolicy,
  basePublicationRestriction,
  type CommonLegalDocument,
} from "./contest-legal.constants";
import { renderContestPdf } from "./contest-pdf";

export async function saveContestLegalDocument(
  tx: Prisma.TransactionClient,
  contest: Contest,
) {
  const errors = legalReadiness(contest);
  if (errors.length) {
    if (contest.published) throw new BadRequestException(errors.join(". "));
    return null;
  }
  const albums = await tx.product.findMany({
    where: { id: { in: contest.prizeAlbumIds } },
    select: { id: true, title: true, slug: true },
    orderBy: { id: "asc" },
  });
  const content = buildContestConditions(contest, albums);
  const pdf = await renderContestPdf(content);
  const id = randomBytes(16).toString("hex");
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  const href = conditionsHref(contest.slug, id);
  const { common, registrationCommandIds } =
    await registerContestConsentDocuments(
      tx,
      contest.id,
      contest.version,
      [
        ...contestLegalPacket.documents,
        {
          id: "contest-conditions",
          version: contestLegalPacket.edition,
          title: content.title,
          href,
          fileHref: `${href}/file`,
          sha256,
          content,
        },
      ],
      pdf,
    );
  const document = await tx.contestLegalDocument.create({
    data: {
      id,
      contestId: contest.id,
      contestVersion: contest.version,
      edition: contestLegalPacket.edition,
      title: content.title,
      content: content as unknown as Prisma.InputJsonValue,
      sourceSnapshot: { ...JSON.parse(JSON.stringify(contest)), albums },
      commonDocuments: common as unknown as Prisma.InputJsonValue,
      registrationCommandIds,
      sha256,
      pdf: new Uint8Array(pdf),
      publishedAt: contest.published ? new Date() : null,
    },
  });
  await tx.contest.update({
    where: { id: contest.id },
    data: { legalDocumentId: document.id },
  });
  return document.id;
}

/** Register the current form without changing previously published documents
 * or the form snapshots attached to historical acceptances. */
export async function registerContestConsentDocuments(
  tx: Prisma.TransactionClient,
  contestId: string,
  contestVersion: number,
  documents: CommonLegalDocument[],
  conditionsPdf: Buffer,
) {
  const form = {
    version: 3,
    purpose: "contest_entry",
    minimumAge: 18,
    requiredConfirmations: ["personalDataAccepted", "publicationAccepted"],
    rulesAcceptance: {
      method: "submit",
      buttonLabel: "Отправить работу",
      notice:
        "Нажимая «Отправить работу», вы принимаете правила и условия конкурса.",
    },
    confirmationLabels: {
      personalDataAccepted: "Даю согласие на обработку персональных данных",
      publicationAccepted: "Даю согласие на публикацию работы",
    },
    identitySource: "customer_profile",
    identityFields: ["name", "email", "phone", "profileRevision"],
    objectFields: ["photoSha256", "caption", "albumId", "number", "revisionId"],
    publication: contestPublicationPolicy,
    basePublicationRestriction,
  } as unknown as Prisma.InputJsonValue;
  const common = [];
  const registrationCommandIds: string[] = [];
  for (const document of documents) {
    const conditions = document.id === "contest-conditions";
    const kind =
      conditions || document.id === "contest-rules"
        ? "RULES"
        : document.id === "contest-personal-data-consent"
          ? "PERSONAL_DATA"
          : "PUBLICATION";
    const registration = await ConsentOperations.enqueueRegistration(tx, {
      kind,
      purpose: conditions ? `contest_conditions:${contestId}` : "contest_entry",
      version: conditions
        ? `${document.version}:${contestVersion}:form3`
        : `${document.version}:form3`,
      title: document.title,
      document: conditions
        ? conditionsPdf
        : readFileSync(resolve(legalAssets, basename(document.fileHref))),
      form,
    });
    registrationCommandIds.push(registration.commandId);
    common.push({ ...document, revisionId: registration.revisionId });
  }
  return { common, registrationCommandIds };
}
export function mapLegalDocument(
  slug: string,
  document: {
    id: string;
    title: string;
    sha256: string;
    edition: string;
    createdAt: Date;
  },
) {
  return {
    id: document.id,
    title: document.title,
    sha256: document.sha256,
    edition: document.edition,
    updatedAt: document.createdAt.toISOString(),
    href: conditionsHref(slug, document.id),
    fileHref: `${conditionsHref(slug, document.id)}/file`,
  };
}

export async function waitForContestDocuments(
  db: PrismaService,
  documentId: string | null,
) {
  if (!documentId) return;
  const document = await db.contestLegalDocument.findUniqueOrThrow({
    where: { id: documentId },
    select: { registrationCommandIds: true },
  });
  await Promise.all(
    document.registrationCommandIds.map((id) => ConsentOperations.wait(db, id)),
  );
}
