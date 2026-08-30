import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import sharp from "sharp";

import { ColoringMediaService } from "../src/colorings/coloring-media.service";
import { ColoringStorageService } from "../src/colorings/coloring-storage.service";

const mutableFsPromises = createRequire(__filename)(
  "node:fs/promises",
) as typeof import("node:fs/promises");

type StorageEntry = {
  key: string;
  buffer: Buffer;
  checksum: string;
};

type StoredFile = { key: string; created: boolean };

type StorageApi = {
  writePrivatePair(entries: StorageEntry[]): Promise<StoredFile[]>;
  materializePublicPair(
    entries: Array<{
      key: string;
      checksum: string;
      width: number;
      height: number;
    }>,
  ): Promise<StoredFile[]>;
  readProtected(
    key: string,
    expected: { checksum: string; width: number; height: number },
  ): Promise<Buffer>;
  readPublic(
    key: string,
    expected: { checksum: string; width: number; height: number },
  ): Promise<Buffer>;
  cleanupPrivate(keys: string[]): Promise<void>;
  cleanupPublic(files: StoredFile[]): Promise<void>;
};

describe("ColoringStorageService", () => {
  it("atomically writes a private pair and reuses matching immutable files", async () => {
    await withStorage(async ({ service, privateRoot }) => {
      const outline = await derivative({ r: 10, g: 20, b: 30 });
      const colored = await derivative({ r: 30, g: 80, b: 150 });
      const entries = pairEntries(outline, colored);

      const first = await service.writePrivatePair(entries);
      const second = await service.writePrivatePair(entries);
      const files = await readdir(
        join(privateRoot, "coloring-1", "a".repeat(32)),
      );

      assert.deepEqual(
        first.map(({ created }) => created),
        [true, true],
      );
      assert.deepEqual(
        second.map(({ created }) => created),
        [false, false],
      );
      assert.equal(
        files.some((file) => file.includes(".tmp-")),
        false,
      );
    });
  });

  it("never creates an empty destination reservation before publishing a file", async (t) => {
    await withStorage(async ({ service }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);
      const originalOpen = mutableFsPromises.open;

      assert.ok(entry);
      t.mock.method(
        mutableFsPromises,
        "open",
        async (...args: Parameters<typeof originalOpen>) => {
          const [path] = args;
          assert.match(String(path), /\.tmp-/);
          return originalOpen(...args);
        },
      );

      await service.writePrivatePair([entry]);
    });
  });

  for (const code of ["EPERM", "EXDEV"] as const) {
    it(`falls back to exclusive copy when hardlink publication fails with ${code}`, async (t) => {
      await withStorage(async ({ service, privateRoot }) => {
        const image = await derivative({ r: 10, g: 20, b: 30 });
        const [entry] = pairEntries(image, image);
        let linkAttempts = 0;

        assert.ok(entry);
        t.mock.method(mutableFsPromises, "link", async () => {
          linkAttempts += 1;
          throw Object.assign(new Error("simulated hardlink failure"), {
            code,
          });
        });

        assert.deepEqual(await service.writePrivatePair([entry]), [
          { key: entry.key, created: true },
        ]);
        assert.equal(linkAttempts, 1);
        assert.deepEqual(await readFile(join(privateRoot, entry.key)), image);
      });
    });
  }

  it("removes a temporary file when writing it fails", async (t) => {
    await withStorage(async ({ service, privateRoot }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);
      const originalOpen = mutableFsPromises.open;

      assert.ok(entry);
      t.mock.method(
        mutableFsPromises,
        "open",
        async (...args: Parameters<typeof originalOpen>) => {
          const handle = await originalOpen(...args);

          return {
            stat: handle.stat.bind(handle),
            writeFile: async () => {
              throw new Error("simulated write failure");
            },
            sync: handle.sync.bind(handle),
            close: handle.close.bind(handle),
          } as unknown as Awaited<ReturnType<typeof mutableFsPromises.open>>;
        },
      );

      await assert.rejects(service.writePrivatePair([entry]));
      const directory = join(privateRoot, "coloring-1", "a".repeat(32));
      assert.deepEqual(await readdir(directory), []);
    });
  });

  it("logs a temporary cleanup failure without exposing its path", async (t) => {
    await withStorage(async ({ service }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);
      const originalUnlink = mutableFsPromises.unlink;
      const warnings: unknown[][] = [];

      assert.ok(entry);
      t.mock.method(Logger.prototype, "warn", (...args: unknown[]) => {
        warnings.push(args);
      });
      t.mock.method(
        mutableFsPromises,
        "unlink",
        async (...args: Parameters<typeof originalUnlink>) => {
          if (String(args[0]).includes(".tmp-")) {
            throw new Error("simulated temporary cleanup failure");
          }

          return originalUnlink(...args);
        },
      );

      await service.writePrivatePair([entry]);

      assert.deepEqual(warnings, [
        ["Failed to clean temporary coloring asset"],
      ]);
    });
  });

  it("does not overwrite a colliding immutable key", async () => {
    await withStorage(async ({ service, privateRoot }) => {
      const original = await derivative({ r: 10, g: 20, b: 30 });
      const replacement = await derivative({ r: 200, g: 20, b: 30 });
      const checksum = sha256(replacement);
      const key = `coloring-1/${"a".repeat(32)}/outline-${checksum}.webp`;
      const path = join(privateRoot, key);

      await mkdir(join(privateRoot, "coloring-1", "a".repeat(32)), {
        recursive: true,
      });
      await writeFile(path, original);
      await assert.rejects(
        service.writePrivatePair([
          {
            key,
            buffer: replacement,
            checksum,
          },
        ]),
        ConflictException,
      );
      assert.deepEqual(await readFile(path), original);
    });
  });

  it("cleans the first private file when writing the second file fails", async () => {
    await withStorage(async ({ service, privateRoot }) => {
      const outline = await derivative({ r: 10, g: 20, b: 30 });
      const colored = await derivative({ r: 30, g: 80, b: 150 });
      const entries = pairEntries(outline, colored);
      const second = entries[1];

      assert.ok(second);
      const collisionPath = join(privateRoot, second.key);
      await mkdir(join(collisionPath, ".."), { recursive: true });
      await writeFile(collisionPath, Buffer.from("collision"));

      await assert.rejects(
        service.writePrivatePair(entries),
        ConflictException,
      );
      await assert.rejects(readFile(join(privateRoot, entries[0]!.key)));
      assert.deepEqual(await readFile(collisionPath), Buffer.from("collision"));
    });
  });

  it("rejects unsafe relative keys", async () => {
    await withStorage(async ({ service }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });

      await assert.rejects(
        service.writePrivatePair([
          { key: "../escape.webp", buffer: image, checksum: sha256(image) },
        ]),
        BadRequestException,
      );
    });
  });

  it("rejects a key whose suffix does not match the derivative checksum", async () => {
    await withStorage(async ({ service }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);

      assert.ok(entry);
      await assert.rejects(
        service.writePrivatePair([
          {
            ...entry,
            key: entry.key.replace(entry.checksum, "f".repeat(64)),
          },
        ]),
        BadRequestException,
      );
    });
  });

  it("rejects a symlinked private root without writing outside it", async () => {
    await withStorage(async ({ service, privateRoot }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);
      const outsideRoot = join(privateRoot, "..", "outside-private");

      assert.ok(entry);
      await mkdir(outsideRoot, { recursive: true });
      await symlink(outsideRoot, privateRoot, "dir");

      await assert.rejects(service.writePrivatePair([entry]));
      await assert.rejects(readFile(join(outsideRoot, entry.key)));
    });
  });

  it("does not follow a private directory symlink during cleanup", async () => {
    await withStorage(async ({ service, privateRoot }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);
      const outsideDirectory = join(privateRoot, "..", "private-cleanup");
      const outsideFile = join(
        outsideDirectory,
        entry!.key.slice("coloring-1/".length),
      );

      assert.ok(entry);
      await mkdir(join(outsideFile, ".."), { recursive: true });
      await writeFile(outsideFile, image);
      await mkdir(privateRoot, { recursive: true });
      await symlink(outsideDirectory, join(privateRoot, "coloring-1"), "dir");

      await service.cleanupPrivate([entry.key]);

      assert.deepEqual(await readFile(outsideFile), image);
    });
  });

  it("verifies and materializes public files with private-to-public fallback", async () => {
    await withStorage(async ({ service, publicRoot }) => {
      const outline = await derivative({ r: 10, g: 20, b: 30 });
      const colored = await derivative({ r: 30, g: 80, b: 150 });
      const entries = pairEntries(outline, colored);
      await service.writePrivatePair(entries);

      const publicFiles = await service.materializePublicPair(
        entries.map(({ key, checksum }) => ({
          key,
          checksum,
          width: 20,
          height: 10,
        })),
      );
      await service.cleanupPrivate(entries.map(({ key }) => key));
      const republishedFiles = await service.materializePublicPair(
        entries.map(({ key, checksum }) => ({
          key,
          checksum,
          width: 20,
          height: 10,
        })),
      );

      assert.deepEqual(
        publicFiles.map(({ created }) => created),
        [true, true],
      );
      assert.deepEqual(
        republishedFiles.map(({ created }) => created),
        [false, false],
      );
      assert.deepEqual(
        await service.readProtected(entries[0]!.key, {
          checksum: entries[0]!.checksum,
          width: 20,
          height: 10,
        }),
        outline,
      );
      assert.deepEqual(
        await readFile(join(publicRoot, entries[1]!.key)),
        colored,
      );
    });
  });

  it("removes only public files created by the failed operation", async () => {
    await withStorage(async ({ service, publicRoot }) => {
      const outline = await derivative({ r: 10, g: 20, b: 30 });
      const colored = await derivative({ r: 30, g: 80, b: 150 });
      const entries = pairEntries(outline, colored);
      await service.writePrivatePair(entries);
      const firstPublish = await service.materializePublicPair(
        entries.map(({ key, checksum }) => ({
          key,
          checksum,
          width: 20,
          height: 10,
        })),
      );
      const reusedPublish = await service.materializePublicPair(
        entries.map(({ key, checksum }) => ({
          key,
          checksum,
          width: 20,
          height: 10,
        })),
      );

      await service.cleanupPublic(reusedPublish);
      assert.equal(
        firstPublish.every(({ created }) => created),
        true,
      );
      assert.equal(
        reusedPublish.every(({ created }) => !created),
        true,
      );
      assert.deepEqual(
        await readFile(join(publicRoot, entries[0]!.key)),
        outline,
      );
    });
  });

  it("reads a checksummed public derivative without consulting private storage", async () => {
    await withStorage(async ({ service, privateRoot, publicRoot }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);

      assert.ok(entry);
      await mkdir(join(privateRoot, entry.key, ".."), { recursive: true });
      await mkdir(join(publicRoot, entry.key, ".."), { recursive: true });
      await writeFile(join(privateRoot, entry.key), Buffer.from("private"));
      await writeFile(join(publicRoot, entry.key), image);

      assert.deepEqual(
        await service.readPublic(entry.key, {
          checksum: entry.checksum,
          width: 20,
          height: 10,
        }),
        image,
      );
    });
  });

  it("rechecks immutable public bytes without repeating publish-time media decoding", async () => {
    let verificationCount = 0;
    const mediaService = {
      verifyDerivative: async () => {
        verificationCount += 1;
      },
    } as unknown as ColoringMediaService;

    await withStorage(async ({ service, publicRoot }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);

      assert.ok(entry);
      await mkdir(join(publicRoot, entry.key, ".."), { recursive: true });
      await writeFile(join(publicRoot, entry.key), image);

      const expected = {
        checksum: entry.checksum,
        width: 20,
        height: 10,
      };

      await Promise.all([
        service.readPublic(entry.key, expected),
        service.readPublic(entry.key, expected),
      ]);
      assert.equal(verificationCount, 0);

      await writeFile(join(publicRoot, entry.key), Buffer.from("tampered"));
      await assertSanitizedUnavailable(
        service.readPublic(entry.key, expected),
        entry.key,
      );
      assert.equal(verificationCount, 0);
    }, mediaService);
  });

  it("maps a public read through a directory symlink to sanitized 503", async () => {
    await withStorage(async ({ service, publicRoot }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);
      const outsideDirectory = join(publicRoot, "..", "outside-public-read");
      const outsideFile = join(
        outsideDirectory,
        entry!.key.slice("coloring-1/".length),
      );

      assert.ok(entry);
      await mkdir(join(outsideFile, ".."), { recursive: true });
      await writeFile(outsideFile, image);
      await mkdir(publicRoot, { recursive: true });
      await symlink(outsideDirectory, join(publicRoot, "coloring-1"), "dir");

      await assertSanitizedUnavailable(
        service.readPublic(entry.key, {
          checksum: entry.checksum,
          width: 20,
          height: 10,
        }),
        outsideDirectory,
      );
    });
  });

  it("maps a public read through a final symlink to sanitized 503", async () => {
    await withStorage(async ({ service, publicRoot }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);
      const outsideFile = join(publicRoot, "..", "outside-public.webp");
      const destination = join(publicRoot, entry!.key);

      assert.ok(entry);
      await writeFile(outsideFile, image);
      await mkdir(join(destination, ".."), { recursive: true });
      await symlink(outsideFile, destination, "file");

      await assertSanitizedUnavailable(
        service.readPublic(entry.key, {
          checksum: entry.checksum,
          width: 20,
          height: 10,
        }),
        outsideFile,
      );
    });
  });

  it("does not materialize or clean public files through a directory symlink", async () => {
    await withStorage(async ({ service, publicRoot }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);
      const outsideDirectory = join(publicRoot, "..", "outside-public-write");
      const outsideFile = join(
        outsideDirectory,
        entry!.key.slice("coloring-1/".length),
      );

      assert.ok(entry);
      await service.writePrivatePair([entry]);
      await mkdir(join(outsideFile, ".."), { recursive: true });
      await mkdir(publicRoot, { recursive: true });
      await symlink(outsideDirectory, join(publicRoot, "coloring-1"), "dir");

      await assert.rejects(
        service.materializePublicPair([
          { key: entry.key, checksum: entry.checksum, width: 20, height: 10 },
        ]),
      );
      await assert.rejects(readFile(outsideFile));

      await writeFile(outsideFile, image);
      await service.cleanupPublic([{ key: entry.key, created: true }]);
      assert.deepEqual(await readFile(outsideFile), image);
    });
  });

  it("never falls back to a private derivative during a public read", async () => {
    await withStorage(async ({ service }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);

      assert.ok(entry);
      await service.writePrivatePair([entry]);

      await assertSanitizedUnavailable(
        service.readPublic(entry.key, {
          checksum: entry.checksum,
          width: 20,
          height: 10,
        }),
        entry.key,
      );
    });
  });

  it("maps a public checksum verification failure to sanitized 503", async () => {
    await withStorage(async ({ service, publicRoot }) => {
      const image = await derivative({ r: 10, g: 20, b: 30 });
      const [entry] = pairEntries(image, image);

      assert.ok(entry);
      await mkdir(join(publicRoot, entry.key, ".."), { recursive: true });
      await writeFile(join(publicRoot, entry.key), image);

      await assertSanitizedUnavailable(
        service.readPublic(entry.key, {
          checksum: "f".repeat(64),
          width: 20,
          height: 10,
        }),
        entry.key,
      );
    });
  });
});

async function withStorage(
  callback: (context: {
    service: StorageApi;
    privateRoot: string;
    publicRoot: string;
  }) => Promise<void>,
  mediaService: ColoringMediaService = new ColoringMediaService(),
) {
  const root = await mkdtemp(join(process.cwd(), "coloring-storage-test-"));
  const privateRoot = join(root, "private");
  const publicRoot = join(root, "public");
  const instance = new ColoringStorageService(mediaService, {
    privateRoot,
    publicRoot,
  });

  try {
    await callback({
      service: instance as unknown as StorageApi,
      privateRoot,
      publicRoot,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function derivative(background: { r: number; g: number; b: number }) {
  return sharp({
    create: { width: 20, height: 10, channels: 3, background },
  })
    .webp()
    .toBuffer();
}

function pairEntries(outline: Buffer, colored: Buffer): StorageEntry[] {
  const revisionId = "a".repeat(32);
  const outlineChecksum = sha256(outline);
  const coloredChecksum = sha256(colored);

  return [
    {
      key: `coloring-1/${revisionId}/outline-${outlineChecksum}.webp`,
      buffer: outline,
      checksum: outlineChecksum,
    },
    {
      key: `coloring-1/${revisionId}/colored-${coloredChecksum}.webp`,
      buffer: colored,
      checksum: coloredChecksum,
    },
  ];
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function assertSanitizedUnavailable(
  promise: Promise<unknown>,
  privateValue: string,
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ServiceUnavailableException);
    assert.equal(error.message, "Coloring asset is temporarily unavailable");
    assert.equal(error.message.includes(privateValue), false);
    assert.equal(error.message.includes(process.cwd()), false);
    return true;
  });
}
