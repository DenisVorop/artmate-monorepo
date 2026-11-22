import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { before, after, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { ConsentDecisionCommandHandler } from "../src/consents/consent-decision-command.handler";
import {
  ConsentOperations,
  ConsentOperationError,
  type ConsentObjectContext,
  type ConsentOperationIntent,
} from "../src/consents/contracts/consent-operations.contract";
import { RequestEvidenceCapture } from "../src/common/request-evidence-capture";

// Explicit local opt-in; never touches a runtime database.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const databaseUrl = process.env.ARTMATE_CONTESTS_TEST_DATABASE_URL;
describe(
  "one Consents inbox for arbitrary objects, with no dependency on Contests",
  { skip: !databaseUrl && "test database is not set" },
  () => {
    let db: PrismaClient, actor: string, handler: ConsentDecisionCommandHandler;
    before(async () => {
      const url = new URL(databaseUrl!);
      assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
      assert.match(url.pathname, /^\/artmate_contests_test[a-z0-9_]*$/);
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url.href }),
      });
      await db.$connect();
      actor = (
        await db.user.create({
          data: {
            name: "Участник проверки",
            email: `${randomUUID()}@example.test`,
            emailVerifiedAt: new Date(),
          },
        })
      ).id;
      handler = new ConsentDecisionCommandHandler(
        db as unknown as PrismaService,
      );
    });
    after(async () => {
      await db?.$disconnect();
    });
    const context = (): ConsentObjectContext => ({
      purpose: "test_documents",
      subjectId: randomUUID(),
      contextKey: randomUUID(),
      userId: actor,
    });
    async function run(intent: ConsentOperationIntent) {
      const id = await db.$transaction((tx) =>
        ConsentOperations.enqueue(tx, `test:${randomUUID()}`, intent),
      );
      await handler.process(id);
      return { id, receipt: await ConsentOperations.result(db, id) };
    }
    async function registration() {
      const form = {
        z: "Последнее поле",
        a: "Первое поле",
        confirmations: ["required"],
      };
      const result = await db.$transaction((tx) =>
        ConsentOperations.enqueueRegistration(tx, {
          kind: "PERSONAL_DATA",
          purpose: `test:${randomUUID()}`,
          version: "1",
          title: "Согласие для проверки",
          document: Buffer.from("Документ"),
          form,
        }),
      );
      assert.equal(
        await db.consentRevision.count({ where: { id: result.revisionId } }),
        0,
        "enqueuing must not register a document",
      );
      await handler.process(result.commandId);
      const row = await db.consentRevision.findUniqueOrThrow({
        where: { id: result.revisionId },
      });
      assert.equal(
        Buffer.from(row.formSnapshotBytes).toString(),
        JSON.stringify(form),
        "JSONB transport must preserve the original form bytes",
      );
      assert.equal(
        row.formSha256,
        createHash("sha256").update(JSON.stringify(form)).digest("hex"),
      );
      return result.revisionId;
    }
    it("registers retained bytes only in the owner and creates offers with different supplied periods", async () => {
      const revisionId = await registration();
      for (const years of [1, 7, 15]) {
        const { receipt } = await run({
          contractVersion: 1,
          type: "OFFER",
          context: context(),
          revisionIds: [revisionId],
          validity: { years },
        });
        assert.equal(receipt?.status, "COMPLETED");
        if (receipt?.status !== "COMPLETED" || receipt.result.type !== "OFFER")
          throw new Error("expected offer");
        const offer = receipt.result.offer;
        assert.equal(
          new Date(offer.endsAt).getUTCFullYear() -
            new Date(offer.startsAt).getUTCFullYear(),
          years,
        );
      }
      const bad = await run({
        contractVersion: 1,
        type: "OFFER",
        context: context(),
        revisionIds: [revisionId],
        validity: { years: 0 },
      });
      assert.deepEqual(bad.receipt, {
        status: "REJECTED",
        errorCode: "INVALID_VALIDITY",
      });
    });
    it("consumes one object offer exactly once across retries and separate handler instances", async () => {
      const revisionId = await registration(),
        scope = context();
      const prepared = await run({
        contractVersion: 1,
        type: "OFFER",
        context: scope,
        revisionIds: [revisionId],
        validity: { years: 2 },
      });
      if (
        prepared.receipt?.status !== "COMPLETED" ||
        prepared.receipt.result.type !== "OFFER"
      )
        throw new Error("expected offer");
      const evidence = RequestEvidenceCapture.from({
        method: "POST",
        url: "/test/consents",
        headers: { "user-agent": "consent-integration-test" },
      });
      const intent: ConsentOperationIntent = {
        contractVersion: 1,
        type: "ACCEPT",
        context: scope,
        offerId: prepared.receipt.result.offer.id,
        decisions: [{ revisionId, accepted: true }],
        individualPart: { object: "any-domain-object" },
        evidence,
      };
      const commandId = await db.$transaction((tx) =>
        ConsentOperations.enqueue(tx, `test:${randomUUID()}`, intent),
      );
      assert.equal(
        await db.contextualConsentAcceptance.count({
          where: { subjectId: scope.subjectId },
        }),
        0,
      );
      const restarted = new ConsentDecisionCommandHandler(
        db as unknown as PrismaService,
      );
      await Promise.all([
        handler.process(commandId),
        restarted.process(commandId),
      ]);
      const receipt = await ConsentOperations.result(db, commandId);
      assert.equal(receipt?.status, "COMPLETED");
      assert.equal(
        await db.contextualConsentAcceptance.count({
          where: { subjectId: scope.subjectId },
        }),
        1,
      );
      assert.equal(await restarted.process(commandId), false);
      const replay = await run(intent);
      assert.deepEqual(replay.receipt, {
        status: "REJECTED",
        errorCode: "OFFER_CHANGED",
      });
      await assert.rejects(
        db.applyConsentDecisionCommand.update({
          where: { id: commandId },
          data: { result: {} },
        }),
        /immutable/i,
      );
      const user = await db.user.findUniqueOrThrow({ where: { id: actor } });
      assert.equal(
        await db.userConsentState.count({ where: { email: user.email! } }),
        0,
        "object decisions must not fabricate Auth readiness",
      );
    });
    it("rechecks decisions, identity and document retirement at acceptance time", async () => {
      const revisionId = await registration(),
        scope = context();
      const prepared = await run({
        contractVersion: 1,
        type: "OFFER",
        context: scope,
        revisionIds: [revisionId],
        validity: { years: 5 },
      });
      if (
        prepared.receipt?.status !== "COMPLETED" ||
        prepared.receipt.result.type !== "OFFER"
      )
        throw new Error("expected offer");
      const offerId = prepared.receipt.result.offer.id;
      const input: Extract<ConsentOperationIntent, { type: "ACCEPT" }> = {
        contractVersion: 1,
        type: "ACCEPT",
        context: scope,
        offerId,
        decisions: [{ revisionId, accepted: false }],
        individualPart: { object: "not-a-contest" },
        evidence: RequestEvidenceCapture.from({
          method: "POST",
          url: "/test/consents",
          headers: {},
        }),
      };
      assert.deepEqual((await run(input)).receipt, {
        status: "REJECTED",
        errorCode: "REQUIRED_CONSENT_MISSING",
      });
      const other = await db.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          emailVerifiedAt: new Date(),
        },
      });
      assert.deepEqual(
        (
          await run({
            ...input,
            context: { ...scope, userId: other.id },
            decisions: [{ revisionId, accepted: true }],
          })
        ).receipt,
        { status: "REJECTED", errorCode: "OFFER_CHANGED" },
      );
      await db.consentRevision.update({
        where: { id: revisionId },
        data: { retiredAt: new Date() },
      });
      assert.deepEqual(
        (await run({ ...input, decisions: [{ revisionId, accepted: true }] }))
          .receipt,
        { status: "REJECTED", errorCode: "CONSENT_REVISION_CHANGED" },
      );
      assert.equal(
        (
          await db.contextualConsentOffer.findUniqueOrThrow({
            where: { id: offerId },
          })
        ).usedAt,
        null,
      );
      assert.equal(
        await db.contextualConsentAcceptance.count({ where: { offerId } }),
        0,
      );
    });
    it("rejects conflicting intents and a retired revision without consuming an offer", async () => {
      const revisionId = await registration(),
        scope = context(),
        key = `test:${randomUUID()}`;
      const input: ConsentOperationIntent = {
        contractVersion: 1,
        type: "OFFER",
        context: scope,
        revisionIds: [revisionId],
        validity: { years: 3 },
      };
      const id = await db.$transaction((tx) =>
        ConsentOperations.enqueue(tx, key, input),
      );
      await assert.rejects(
        db.$transaction((tx) =>
          ConsentOperations.enqueue(tx, key, {
            ...input,
            validity: { years: 15 },
          }),
        ),
        (e: unknown) =>
          e instanceof ConsentOperationError && e.code === "OPERATION_CONFLICT",
      );
      await db.consentRevision.update({
        where: { id: revisionId },
        data: { retiredAt: new Date() },
      });
      await handler.process(id);
      assert.deepEqual(await ConsentOperations.result(db, id), {
        status: "REJECTED",
        errorCode: "CONSENT_REVISION_CHANGED",
      });
    });
  },
);
