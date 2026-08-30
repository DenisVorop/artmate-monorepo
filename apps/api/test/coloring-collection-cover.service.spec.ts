import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { BadRequestException, ConflictException } from "@nestjs/common";
import sharp from "sharp";

import { ColoringCollectionCoverService } from "../src/colorings/coloring-collection-cover.service";
import { ColoringCollectionStatus } from "../src/generated/prisma/client";

const mutableFsPromises = createRequire(__filename)(
  "node:fs/promises",
) as typeof import("node:fs/promises");
const initialUpdatedAt = new Date("2026-08-29T12:00:00.000Z");

describe("ColoringCollectionCoverService", () => {
  it("normalizes an uploaded cover into an immutable public WebP", async () => {
    await withService(async ({ service, root, stored, updateCalls }) => {
      const source = await sharp({
        create: {
          width: 2_000,
          height: 1_000,
          channels: 3,
          background: { r: 80, g: 120, b: 160 },
        },
      })
        .withMetadata({ exif: { IFD0: { Copyright: "private" } } })
        .jpeg()
        .toBuffer();

      const cover = await service.uploadCover(
        "collection-1",
        upload(source, "image/jpeg"),
        "  Обложка загадочного леса  ",
        initialUpdatedAt.toISOString(),
      );
      const pathname = new URL(cover.url).pathname;
      const local = join(root, pathname.replace(/^\/uploads\//, ""));
      const output = await readFile(local);
      const metadata = await sharp(output).metadata();

      assert.match(
        cover.url,
        /^http:\/\/api\.example\/uploads\/coloring-collections\/collection-1\/cover-[0-9a-f]{64}\.webp$/,
      );
      assert.deepEqual(cover, {
        url: cover.url,
        alt: "Обложка загадочного леса",
        width: 1200,
        height: 600,
      });
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.space, "srgb");
      assert.equal(metadata.exif, undefined);
      assert.equal(stored.coverUrl, cover.url);
      assert.equal(stored.coverAlt, cover.alt);
      assert.equal(updateCalls.length, 1);
      assert.deepEqual(updateCalls[0]?.where, {
        id: "collection-1",
        status: ColoringCollectionStatus.DRAFT,
        updatedAt: initialUpdatedAt,
      });
      assert.ok(stored.updatedAt.getTime() > initialUpdatedAt.getTime());
    });
  });

  it("rejects magic bytes that do not match the declared MIME", async () => {
    await withService(async ({ service }) => {
      const source = await sharp({
        create: {
          width: 20,
          height: 20,
          channels: 3,
          background: { r: 80, g: 120, b: 160 },
        },
      })
        .png()
        .toBuffer();

      await assert.rejects(
        service.uploadCover(
          "collection-1",
          upload(source, "image/jpeg"),
          "Обложка",
          initialUpdatedAt.toISOString(),
        ),
        BadRequestException,
      );
    });
  });

  it("does not expose a partial final cover when an atomic write fails", async (t) => {
    await withService(async ({ service, root, stored }) => {
      const source = await sharp({
        create: {
          width: 40,
          height: 30,
          channels: 3,
          background: { r: 80, g: 120, b: 160 },
        },
      })
        .png()
        .toBuffer();
      const originalOpen = mutableFsPromises.open;

      t.mock.method(
        mutableFsPromises,
        "open",
        async (...args: Parameters<typeof originalOpen>) => {
          const handle = await originalOpen(...args);

          if (!String(args[0]).includes(".tmp-")) {
            return handle;
          }

          return {
            stat: handle.stat.bind(handle),
            writeFile: async () => {
              throw new Error("simulated interrupted write");
            },
            sync: handle.sync.bind(handle),
            close: handle.close.bind(handle),
          } as unknown as Awaited<ReturnType<typeof mutableFsPromises.open>>;
        },
      );

      await assert.rejects(
        service.uploadCover(
          "collection-1",
          upload(source, "image/png"),
          "Обложка",
          initialUpdatedAt.toISOString(),
        ),
      );
      assert.deepEqual(
        await readdir(join(root, "coloring-collections", "collection-1")),
        [],
      );
      assert.equal(stored.coverUrl, null);
    });
  });

  it("rejects a stale cover CAS before processing or writing a file", async () => {
    await withService(async ({ root, service, stored, updateCalls }) => {
      const source = await createPng();

      await assert.rejects(
        service.uploadCover(
          "collection-1",
          upload(source, "image/png"),
          "Обложка",
          "2026-08-29T11:59:59.000Z",
        ),
        (error: unknown) =>
          error instanceof ConflictException &&
          error.message === "Coloring collection changed concurrently",
      );

      assert.equal(updateCalls.length, 0);
      assert.equal(stored.coverUrl, null);
      assert.deepEqual(await readdir(root), []);
    });
  });

  for (const status of [
    ColoringCollectionStatus.PUBLISHED,
    ColoringCollectionStatus.ARCHIVED,
  ]) {
    it(`rejects a cover upload for ${status.toLowerCase()} collection`, async () => {
      await withService(async ({ root, service, stored, updateCalls }) => {
        stored.status = status;

        await assert.rejects(
          service.uploadCover(
            "collection-1",
            upload(await createPng(), "image/png"),
            "Обложка",
            initialUpdatedAt.toISOString(),
          ),
          (error: unknown) =>
            error instanceof ConflictException &&
            error.message ===
              "Published or archived coloring collection cover cannot be changed",
        );

        assert.equal(updateCalls.length, 0);
        assert.equal(stored.coverUrl, null);
        assert.deepEqual(await readdir(root), []);
      });
    });
  }

  for (const race of ["publish", "updatedAt"] as const) {
    it(`rejects a cover upload when ${race} changes after processing`, async () => {
      await withService(
        async ({ raceNextUpdate, service, stored, updateCalls }) => {
          raceNextUpdate((record) => {
            if (race === "publish") {
              record.status = ColoringCollectionStatus.PUBLISHED;
            } else {
              record.updatedAt = new Date("2026-08-29T12:00:01.000Z");
            }
          });

          await assert.rejects(
            service.uploadCover(
              "collection-1",
              upload(await createPng(), "image/png"),
              "Обложка",
              initialUpdatedAt.toISOString(),
            ),
            (error: unknown) =>
              error instanceof ConflictException &&
              error.message === "Coloring collection changed concurrently",
          );

          assert.equal(updateCalls.length, 1);
          assert.equal(stored.coverUrl, null);
        },
      );
    });
  }

  it("returns success when the cover update committed before a connection error", async () => {
    await withService(
      async ({ service, failNextUpdateAfterCommit, root, stored }) => {
        const source = await sharp({
          create: {
            width: 40,
            height: 30,
            channels: 3,
            background: { r: 80, g: 120, b: 160 },
          },
        })
          .png()
          .toBuffer();

        failNextUpdateAfterCommit();
        const cover = await service.uploadCover(
          "collection-1",
          upload(source, "image/png"),
          "Обложка",
          initialUpdatedAt.toISOString(),
        );

        assert.equal(cover.url, stored.coverUrl);
        assert.equal(cover.alt, stored.coverAlt);
        assert.equal(cover.width, stored.coverWidth);
        assert.equal(cover.height, stored.coverHeight);
        assert.equal(
          (await readdir(join(root, "coloring-collections", "collection-1")))
            .length,
          1,
        );
      },
      );
    });
  it("does not report ambiguous success after the committed timestamp changes", async () => {
    await withService(async ({
      service,
      failNextUpdateAfterCommit,
      stored,
    }) => {
      failNextUpdateAfterCommit((record) => {
        record.status = ColoringCollectionStatus.PUBLISHED;
        record.updatedAt = new Date(record.updatedAt.getTime() + 1);
      });

      await assert.rejects(
        service.uploadCover(
          "collection-1",
          upload(await createPng(), "image/png"),
          "Обложка",
          initialUpdatedAt.toISOString(),
        ),
        /simulated ambiguous commit/,
      );
      assert.equal(stored.status, ColoringCollectionStatus.PUBLISHED);
    });
  });
});

type StoredCover = {
  id: string;
  status: ColoringCollectionStatus;
  updatedAt: Date;
  coverUrl: string | null;
  coverAlt: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
};

type CoverUpdate = {
  where: {
    id: string;
    status: ColoringCollectionStatus;
    updatedAt: Date;
  };
  data: Partial<StoredCover>;
};

async function withService(
  run: (context: {
    service: ColoringCollectionCoverService;
    root: string;
    stored: StoredCover;
    updateCalls: CoverUpdate[];
    failNextUpdateAfterCommit: (
      mutate?: (stored: StoredCover) => void,
    ) => void;
    raceNextUpdate: (mutate: (stored: StoredCover) => void) => void;
  }) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "artmate-collection-cover-"));
  const stored: StoredCover = {
    id: "collection-1",
    status: ColoringCollectionStatus.DRAFT,
    updatedAt: new Date(initialUpdatedAt),
    coverUrl: null,
    coverAlt: null,
    coverWidth: null,
    coverHeight: null,
  };
  let shouldFailAfterUpdate = false;
  let afterFailedUpdate: ((record: StoredCover) => void) | undefined;
  let beforeNextUpdate: ((record: StoredCover) => void) | undefined;
  const updateCalls: CoverUpdate[] = [];
  const prisma = {
    coloringCollection: {
      findUnique: async () => ({ ...stored }),
      updateMany: async ({ data, where }: CoverUpdate) => {
        updateCalls.push({ data, where });
        beforeNextUpdate?.(stored);
        beforeNextUpdate = undefined;

        if (
          stored.id !== where.id ||
          stored.status !== where.status ||
          stored.updatedAt.getTime() !== where.updatedAt.getTime()
        ) {
          return { count: 0 };
        }

        Object.assign(stored, data);

        if (shouldFailAfterUpdate) {
          shouldFailAfterUpdate = false;
          afterFailedUpdate?.(stored);
          afterFailedUpdate = undefined;
          throw new Error("simulated ambiguous commit");
        }

        return { count: 1 };
      },
    },
  };
  const service = new ColoringCollectionCoverService(prisma as never);
  const configurable = service as unknown as {
    getUploadsRoot: () => string;
    getApiPublicUrl: () => string;
  };

  configurable.getUploadsRoot = () => root;
  configurable.getApiPublicUrl = () => "http://api.example";

  try {
    await run({
      service,
      root,
      stored,
      updateCalls,
      failNextUpdateAfterCommit: (mutate) => {
        shouldFailAfterUpdate = true;
        afterFailedUpdate = mutate;
      },
      raceNextUpdate: (mutate) => {
        beforeNextUpdate = mutate;
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function createPng() {
  return sharp({
    create: {
      width: 40,
      height: 30,
      channels: 3,
      background: { r: 80, g: 120, b: 160 },
    },
  })
    .png()
    .toBuffer();
}

function upload(buffer: Buffer, mimetype: string) {
  return {
    buffer,
    mimetype,
    originalname: "cover",
    size: buffer.length,
  };
}
