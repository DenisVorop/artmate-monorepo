import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ArgumentMetadata, HttpStatus, ValidationPipe } from "@nestjs/common";
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";

import { AuthGuard } from "../src/auth/auth.guard";
import type { ContactsService } from "../src/contacts/contacts.service";
import {
  PartnerApplicationAudienceSize,
  PartnerApplicationPreferredContact,
  PartnerApplicationStatus,
  PartnerApplicationType,
} from "../src/generated/prisma/client";
import {
  CreatePartnerApplicationRequestDTO,
  ListPartnerApplicationsQueryDTO,
} from "../src/partner-applications/dto";
import {
  AdminPartnerApplicationsController,
  PublicPartnerApplicationsController,
} from "../src/partner-applications/partner-applications.controller";
import { PartnerApplicationsThrottleService } from "../src/partner-applications/partner-applications-throttle.service";
import { PartnerApplicationsService } from "../src/partner-applications/partner-applications.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const pipe = new ValidationPipe({
  forbidNonWhitelisted: true,
  transform: true,
  whitelist: true,
});

describe("partner applications HTTP contract", () => {
  it("accepts a valid email application and normalizes optional text", async () => {
    const dto = await transform(CreatePartnerApplicationRequestDTO, {
      ...validInput(),
      comment: "  Хочу делать обзоры  ",
      contactHandle: "",
      utmSource: "  telegram  ",
      website: "",
    });

    assert.equal(dto.comment, "Хочу делать обзоры");
    assert.equal(dto.contactHandle, undefined);
    assert.equal(dto.utmSource, "telegram");
  });

  it("requires a contact handle for Telegram", async () => {
    await assert.rejects(
      transform(CreatePartnerApplicationRequestDTO, {
        ...validInput(),
        preferredContact: "telegram",
      }),
    );

    const dto = await transform(CreatePartnerApplicationRequestDTO, {
      ...validInput(),
      preferredContact: "telegram",
      contactHandle: "  @artmate_creator  ",
    });
    assert.equal(dto.contactHandle, "@artmate_creator");
  });

  it("normalizes supported Telegram contact formats and rejects arbitrary text", async () => {
    for (const contactHandle of [
      "artmate_creator",
      "@artmate_creator",
      "t.me/artmate_creator",
      "https://t.me/artmate_creator",
    ]) {
      const dto = await transform(CreatePartnerApplicationRequestDTO, {
        ...validInput(),
        preferredContact: "telegram",
        contactHandle,
      });

      assert.equal(dto.contactHandle, "@artmate_creator");
    }

    for (const contactHandle of [
      "+7 999 123-45-67",
      "telegram user",
      "https://example.com/artmate_creator",
      "https://t.me/artmate_creator/extra",
    ]) {
      await assert.rejects(
        transform(CreatePartnerApplicationRequestDTO, {
          ...validInput(),
          preferredContact: "telegram",
          contactHandle,
        }),
      );
    }
  });

  it("rejects invalid URLs, consent, enums and unknown fields", async () => {
    for (const input of [
      validInput({ channelUrl: "javascript:alert(1)" }),
      validInput({ consent: false }),
      validInput({ partnerType: "influencer" }),
      validInput({ audienceSize: "huge" }),
      { ...validInput(), unexpected: true },
    ]) {
      await assert.rejects(
        transform(CreatePartnerApplicationRequestDTO, input),
      );
    }
  });

  it("defaults and bounds admin pagination", async () => {
    const defaults = await transform(ListPartnerApplicationsQueryDTO, {});
    assert.deepEqual(
      { page: defaults.page, pageSize: defaults.pageSize },
      { page: 1, pageSize: 20 },
    );

    const query = await transform(ListPartnerApplicationsQueryDTO, {
      page: "2",
      pageSize: "50",
      status: "contacted",
    });
    assert.deepEqual(
      { page: query.page, pageSize: query.pageSize, status: query.status },
      { page: 2, pageSize: 50, status: "contacted" },
    );

    await assert.rejects(
      transform(ListPartnerApplicationsQueryDTO, { pageSize: 101 }),
    );
  });

  it("keeps POST public and protects admin routes", () => {
    const publicHandler =
      PublicPartnerApplicationsController.prototype.createApplication;
    const adminClassGuards = (Reflect.getMetadata(
      GUARDS_METADATA,
      AdminPartnerApplicationsController,
    ) ?? []) as unknown[];

    assert.equal(Reflect.getMetadata(PATH_METADATA, publicHandler), "/");
    assert.equal(
      Reflect.getMetadata(HTTP_CODE_METADATA, publicHandler),
      HttpStatus.ACCEPTED,
    );
    assert.equal(adminClassGuards.includes(AuthGuard), true);
  });
});

describe("PartnerApplicationsService", () => {
  it("persists before Telegram enqueue and keeps the response successful", async () => {
    const events: string[] = [];
    const stored = storedApplication();
    const prisma = {
      partnerApplication: {
        create: async () => {
          events.push("persist");
          return stored;
        },
      },
    } as unknown as PrismaService;
    const contacts = {
      enqueueTelegramNotification: async () => {
        events.push("enqueue");
        throw new Error("Notification queue unavailable");
      },
    } as unknown as ContactsService;
    const service = new PartnerApplicationsService(contacts, prisma);

    await assert.doesNotReject(async () => {
      assert.deepEqual(await service.createApplication(validInput()), {
        accepted: true,
      });
    });
    assert.deepEqual(events, ["persist", "enqueue"]);
  });

  it("silently accepts a filled honeypot without persisting or notifying", async () => {
    let calls = 0;
    const prisma = {
      partnerApplication: {
        create: async () => {
          calls += 1;
          return storedApplication();
        },
      },
    } as unknown as PrismaService;
    const contacts = {
      enqueueTelegramNotification: async () => {
        calls += 1;
      },
    } as unknown as ContactsService;
    const service = new PartnerApplicationsService(contacts, prisma);

    assert.deepEqual(
      await service.createApplication(validInput({ website: "bot value" })),
      { accepted: true },
    );
    assert.equal(calls, 0);
  });

  it("keeps truncated Telegram text valid and removes control characters", async () => {
    let notification = "";
    const prisma = {
      partnerApplication: {
        create: async () =>
          storedApplication({
            name: `${"&".repeat(80)}${"😀".repeat(80)}`,
            comment: "Первая строка\n<b>не разметка</b>\u202e",
          }),
      },
    } as unknown as PrismaService;
    const contacts = {
      enqueueTelegramNotification: async (message: string) => {
        notification = message;
      },
    } as unknown as ContactsService;
    const service = new PartnerApplicationsService(contacts, prisma);

    await service.createApplication(validInput());

    const nameLine = notification
      .split("\n")
      .find((line) => line.startsWith("<b>Имя:</b> "));

    assert.ok(nameLine);
    assert.equal(nameLine.includes("&amp…"), false);
    assert.equal(nameLine.length <= "<b>Имя:</b> ".length + 240, true);
    assert.equal(notification.includes("\u202e"), false);
    assert.equal(notification.includes("Первая строка &lt;b&gt;"), true);
  });

  it("returns the stable paginated admin contract with an optional status filter", async () => {
    const stored = storedApplication();
    const queries: unknown[] = [];
    const prisma = {
      partnerApplication: {
        findMany: (query: unknown) => {
          queries.push(query);
          return Promise.resolve([stored]);
        },
        count: (query: unknown) => {
          queries.push(query);
          return Promise.resolve(3);
        },
      },
      $transaction: async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
    } as unknown as PrismaService;
    const service = new PartnerApplicationsService(
      {} as ContactsService,
      prisma,
    );

    const result = await service.listApplications({
      page: 2,
      pageSize: 1,
      status: "new",
    });

    assert.deepEqual(
      {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        itemStatus: result.items[0]?.status,
      },
      {
        page: 2,
        pageSize: 1,
        total: 3,
        totalPages: 3,
        itemStatus: "new",
      },
    );
    assert.deepEqual(queries, [
      {
        where: { status: PartnerApplicationStatus.NEW },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 1,
        take: 1,
      },
      { where: { status: PartnerApplicationStatus.NEW } },
    ]);
  });
});

describe("PartnerApplicationsThrottleService", () => {
  it("limits repeated submissions by a hashed normalized email", () => {
    const throttle = new PartnerApplicationsThrottleService();

    for (let index = 0; index < 3; index += 1) {
      assert.doesNotThrow(() =>
        throttle.assertAllowed({
          email: index === 0 ? "Creator@Example.com" : "creator@example.com",
          requestIp: `203.0.113.${index + 1}`,
        }),
      );
    }

    assert.throws(
      () =>
        throttle.assertAllowed({
          email: " creator@example.com ",
          requestIp: "203.0.113.20",
        }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "getStatus" in error &&
        (error as { getStatus(): number }).getStatus() === 429,
    );
  });
});

function validInput(
  overrides: Record<string, unknown> = {},
): CreatePartnerApplicationRequestDTO {
  return {
    name: "Анна Петрова",
    email: "creator@example.com",
    preferredContact: "email",
    channelUrl: "https://t.me/artmate_creator",
    partnerType: "creator",
    audienceSize: "1000_10000",
    consent: true,
    ...overrides,
  } as CreatePartnerApplicationRequestDTO;
}

function storedApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: "partner-application-1",
    name: "Анна Петрова",
    email: "creator@example.com",
    preferredContact: PartnerApplicationPreferredContact.EMAIL,
    contactHandle: null,
    channelUrl: "https://t.me/artmate_creator",
    partnerType: PartnerApplicationType.CREATOR,
    audienceSize: PartnerApplicationAudienceSize.FROM_1000,
    comment: null,
    consent: true,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    status: PartnerApplicationStatus.NEW,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
    ...overrides,
  };
}

function transform<T extends object>(type: new () => T, value: unknown) {
  return pipe.transform(value, {
    metatype: type,
    type: "body",
  } as ArgumentMetadata) as Promise<T>;
}
