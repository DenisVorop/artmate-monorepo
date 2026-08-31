import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import type { PrismaService } from "../src/prisma/prisma.service";
import { FeatureBannersService } from "../src/feature-banners/feature-banners.service";

const now = new Date("2026-08-31T12:00:00.000Z");

function banner(audiences: string[]) {
  return {
    id: `banner-${audiences.join("-")}`,
    slug: `banner-${audiences.join("-")}`,
    title: "Banner",
    description: "Description",
    ctaLabel: null,
    ctaHref: null,
    audiences,
    tone: "INFO",
    enabled: true,
    sortOrder: 0,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("feature banner audiences", () => {
  it("matches any selected audience and keeps ALL exclusive semantics", async () => {
    const rows = [
      banner(["ALL"]),
      banner(["ANONYMOUS"]),
      banner(["AUTHENTICATED"]),
      banner(["TELEGRAM_UNLINKED"]),
      banner(["ANONYMOUS", "TELEGRAM_UNLINKED"]),
    ];
    const run = (user: { id: string } | null, linked: boolean) =>
      new FeatureBannersService({
        featureBanner: { findMany: async () => rows },
        telegramAccount: {
          findUnique: async () => (linked ? { id: "telegram-1" } : null),
        },
      } as unknown as PrismaService).getVisibleBanners(user as never);

    assert.deepEqual(
      (await run(null, false)).map((item) => item.audiences),
      [["all"], ["anonymous"], ["anonymous", "telegram_unlinked"]],
    );
    assert.deepEqual(
      (await run({ id: "user-1" }, false)).map((item) => item.audiences),
      [
        ["all"],
        ["authenticated"],
        ["telegram_unlinked"],
        ["anonymous", "telegram_unlinked"],
      ],
    );
    assert.deepEqual(
      (await run({ id: "user-1" }, true)).map((item) => item.audiences),
      [["all"], ["authenticated"]],
    );
  });

  it("defaults create to ALL and leaves audiences unchanged on PATCH", async () => {
    let createData: Record<string, unknown> | undefined;
    let updateData: Record<string, unknown> | undefined;
    const service = new FeatureBannersService({
      featureBanner: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createData = data;
          return banner(data.audiences as string[]);
        },
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updateData = data;
          return banner(["ANONYMOUS"]);
        },
      },
    } as unknown as PrismaService);

    await service.createBanner({
      slug: "new-banner",
      title: "Banner",
      description: "Description",
    });
    await service.updateBanner("banner-1", { enabled: false });

    assert.deepEqual(createData?.audiences, ["ALL"]);
    assert.equal("audience" in createData!, false);
    assert.equal("audiences" in updateData!, false);
  });

  it("rejects invalid audience arrays when the service is called directly", async () => {
    const service = new FeatureBannersService({
      featureBanner: { create: async () => assert.fail("must not write") },
    } as unknown as PrismaService);
    const input = {
      slug: "new-banner",
      title: "Banner",
      description: "Description",
    };

    for (const audiences of [
      null,
      "anonymous",
      [],
      ["anonymous", "anonymous"],
      ["unknown"],
      ["all", "anonymous"],
    ]) {
      await assert.rejects(
        service.createBanner({ ...input, audiences } as never),
        BadRequestException,
      );
    }
  });
});
