import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConsentsModule } from "../src/consents/consents.module";
import { EmailAdvertisingService } from "../src/consents/email-advertising.service";
import { ContactsModule } from "../src/contacts/contacts.module";
import { ContactsService } from "../src/contacts/contacts.service";
import { PartnerApplicationsModule } from "../src/partner-applications/partner-applications.module";
import { PartnerApplicationsService } from "../src/partner-applications/partner-applications.service";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SiteActionGuard } from "../src/auth/site-action.guard";

@Module({
  imports: [
    PrismaModule,
    ContactsModule,
    PartnerApplicationsModule,
    ConsentsModule,
  ],
})
class BusinessFormResolutionModule {}

describe("business form production module wiring", () => {
  it("resolves public Contacts and guarded PartnerApplications modules without connecting to a database", async () => {
    const originalUrl = process.env.DATABASE_URL;
    const originalInit = PrismaService.prototype.onModuleInit;
    process.env.DATABASE_URL =
      "postgresql://isolated:isolated@127.0.0.1:9/unused";
    PrismaService.prototype.onModuleInit = async () => {
      assert.fail(
        "Resolution must not initialize Prisma or connect to a database",
      );
    };
    let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
    try {
      // create() resolves every real module, controller and method enhancer;
      // init()/listen() would start DB lifecycle/workers and are intentionally absent.
      app = await NestFactory.create(BusinessFormResolutionModule, {
        abortOnError: false,
        logger: false,
      });
      assert.ok(
        app.get(EmailAdvertisingService) instanceof EmailAdvertisingService,
      );
      assert.ok(app.get(ContactsService) instanceof ContactsService);
      assert.ok(
        app.get(PartnerApplicationsService) instanceof
          PartnerApplicationsService,
      );
      assert.ok(app.get(SiteActionGuard) instanceof SiteActionGuard);
    } finally {
      await app?.close();
      PrismaService.prototype.onModuleInit = originalInit;
      if (originalUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalUrl;
    }
  });
});
