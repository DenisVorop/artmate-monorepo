import "reflect-metadata";
import assert from "node:assert/strict";
import { it } from "node:test";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { AuthService } from "../src/auth/auth.service";
import { SiteActionGuard } from "../src/auth/site-action.guard";
import { CustomerDirectoryReader } from "../src/auth/customer-directory.reader";
import { PrismaService } from "../src/prisma/prisma.service";
import { ConsentReadModel } from "../src/consents/contracts/consent-read-model";
import type { CustomerAuthDirectoryV1 } from "../src/users/contracts/auth-directory.contract";
import type { SiteActionRequest } from "../src/auth/contracts/site-action-access.contract";
import { ContestEntriesController } from "../src/contests/contest-entries.controller";
import { siteActionMetadataKey } from "../src/auth/require-site-action";

it("contest submissions require a current verified identity, profile and exact required consent without granting advertising", async () => {
  const handler = ContestEntriesController.prototype.submit;
  assert.equal(
    Reflect.getMetadata(siteActionMetadataKey, handler),
    "contest_entry",
  );
  const request = {
    headers: { authorization: "Bearer verified" },
  } as SiteActionRequest;
  const context = {
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const ready: CustomerAuthDirectoryV1 = {
    userId: "customer",
    email: "contest@test.invalid",
    emailVerifiedAt: new Date(),
    name: "Имя",
    phone: "+79990000000",
    status: "active",
    authVersion: 1,
    roles: ["customer"],
    image: null,
    profileRevision: 1,
  };
  let user: CustomerAuthDirectoryV1 = ready;
  let accepted = true;
  const read = ConsentReadModel.read,
    acceptance = ConsentReadModel.requiredAcceptance;
  const guard = new SiteActionGuard(
    new Reflector(),
    {
      getTokenFromRequest: (header?: string) => header,
      verifyFlowSession: async () => ({
        principal: {
          id: ready.userId,
          email: ready.email,
          authVersion: ready.authVersion,
        },
      }),
    } as unknown as AuthService,
    {
      $transaction: async (callback: (tx: object) => Promise<unknown>) =>
        callback({}),
    } as unknown as PrismaService,
    { byId: async () => user } as unknown as CustomerDirectoryReader,
  );
  try {
    ConsentReadModel.read = async () =>
      ({
        requiredAccepted: accepted,
        advertisingAccepted: false,
      }) as unknown as Awaited<ReturnType<typeof read>>;
    ConsentReadModel.requiredAcceptance = async () =>
      accepted ? { id: "accepted-document", revisionId: "required-v1" } : null;
    assert.equal(await guard.canActivate(context), true);
    assert.equal(request.siteAction.actor.userId, ready.userId);
    assert.deepEqual(request.siteAction.requiredConsent, {
      acceptanceId: "accepted-document",
      revisionId: "required-v1",
    });
    user = { ...ready, emailVerifiedAt: null };
    await assert.rejects(guard.canActivate(context), { status: 401 });
    user = { ...ready, name: null };
    await assert.rejects(guard.canActivate(context), { status: 403 });
    user = { ...ready, status: "blocked" };
    await assert.rejects(guard.canActivate(context), { status: 401 });
    user = ready;
    accepted = false;
    await assert.rejects(guard.canActivate(context), { status: 403 });
  } finally {
    ConsentReadModel.read = read;
    ConsentReadModel.requiredAcceptance = acceptance;
  }
});
