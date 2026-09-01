import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { WorkshopAssetDeletionQueueService } from "../src/workshops/workshop-asset-deletion-queue.service";
import { WorkshopStorageService } from "../src/workshops/workshop-storage.service";

const storageKey = `${"a".repeat(32)}/${"b".repeat(32)}/normalized-${"c".repeat(64)}.webp`;

describe("WorkshopAssetDeletionQueueService", () => {
  it("keeps a job and schedules a retry after an I/O failure", async () => {
    const error = new Error("unlink failed");
    const harness = createHarness({ error });
    const before = Date.now();

    await harness.service.processDueJobs();

    assert.ok(harness.state.job);
    assert.equal(harness.state.job.attempts, 1);
    assert.equal(harness.state.job.lockedAt, null);
    assert.equal(harness.state.job.lastError, error.message);
    assert.ok(harness.state.job.nextAttemptAt.getTime() > before);
    assert.deepEqual(harness.storage.keys, [storageKey]);
  });

  it("deletes a job on a later successful run after it becomes due", async () => {
    let shouldFail = true;
    const harness = createHarness({
      deleteAsset: async (key) => {
        harness.storage.keys.push(key);
        if (shouldFail) {
          throw new Error("temporary unlink failure");
        }
      },
    });

    await harness.service.processDueJobs();
    assert.ok(harness.state.job);
    assert.equal(harness.state.job.attempts, 1);

    shouldFail = false;
    harness.state.job.nextAttemptAt = new Date(0);
    await harness.service.processDueJobs();

    assert.equal(harness.state.job, null);
    assert.deepEqual(harness.storage.keys, [storageKey, storageKey]);
  });

  it("treats an already absent asset (ENOENT) as successful deletion", async () => {
    const root = await mkdtemp(join(tmpdir(), "artmate-workshop-queue-"));

    try {
      const storage = new WorkshopStorageService({} as never, root);
      const harness = createHarness({ storage });

      await harness.service.processDueJobs();

      assert.equal(harness.state.job, null);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

type Job = {
  id: string;
  storageKey: string;
  attempts: number;
  nextAttemptAt: Date;
  lockedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Harness = {
  service: WorkshopAssetDeletionQueueService;
  state: { job: Job | null };
  storage: { keys: string[]; deleteAsset: (key: string) => Promise<void> };
};

function createHarness(options: {
  error?: Error;
  deleteAsset?: (key: string) => Promise<void>;
  storage?: WorkshopStorageService;
} = {}): Harness {
  const now = new Date(Date.now() - 1000);
  const state: { job: Job | null } = {
    job: {
      id: "d".repeat(32),
      storageKey,
      attempts: 0,
      nextAttemptAt: now,
      lockedAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    },
  };
  const storage = {
    keys: [] as string[],
    deleteAsset:
      options.deleteAsset ??
      (async (key: string) => {
        storage.keys.push(key);
        if (options.error) {
          throw options.error;
        }
      }),
  };

  const prisma = {
    workshopAssetDeletionJob: {
      updateMany: async (args: {
        where: { id?: string };
        data: Record<string, unknown>;
      }) => {
        if (!args.where.id) {
          return { count: 0 };
        }

        if (
          state.job &&
          state.job.id === args.where.id &&
          state.job.lockedAt === null
        ) {
          state.job.lockedAt = args.data.lockedAt as Date;
          return { count: 1 };
        }

        return { count: 0 };
      },
      findMany: async () => {
        if (
          state.job &&
          state.job.lockedAt === null &&
          state.job.nextAttemptAt.getTime() <= Date.now()
        ) {
          return [state.job];
        }

        return [];
      },
      update: async (args: {
        where: { id: string };
        data: Partial<Job>;
      }) => {
        assert.ok(state.job);
        assert.equal(state.job.id, args.where.id);
        Object.assign(state.job, args.data);
        return state.job;
      },
      delete: async (args: { where: { id: string } }) => {
        assert.ok(state.job);
        assert.equal(state.job.id, args.where.id);
        state.job = null;
        return {};
      },
    },
  };

  const service = new WorkshopAssetDeletionQueueService(
    prisma as never,
    (options.storage ?? storage) as never,
  );

  return { service, state, storage };
}
