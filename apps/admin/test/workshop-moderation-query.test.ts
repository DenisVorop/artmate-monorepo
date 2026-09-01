import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const query = read("../src/entities/workshop-moderation/model/query.ts");
const cache = read("../src/features/workshop-moderation/model/cache.ts");
const filters = read("../src/features/workshop-moderation/lib/queue-state.ts");

test("query keys isolate status queues, revision detail and asset variant", () => {
  assert.match(query, /queue: \(status: WorkshopModerationStatus\)/);
  assert.match(query, /workshopModerationQueryKeys\.queues\(\), status/);
  assert.match(query, /detail: \(revisionId: string\)/);
  assert.match(query, /"asset",\s*variant/);
});

test("decision cache updates exact detail and invalidates every queue", () => {
  assert.match(cache, /setQueryData\(/);
  assert.match(cache, /detail\(detail\.revisionId\)/);
  assert.match(cache, /invalidateQueries\(/);
  assert.match(cache, /workshopModerationQueryKeys\.queues\(\)/);
});

test("status filters are exhaustive, typed and default to pending", () => {
  for (const status of ["PENDING", "APPROVED", "CHANGES_REQUESTED", "HIDDEN"]) {
    assert.match(filters, new RegExp(`"${status}"`));
  }

  assert.match(filters, /satisfies readonly WorkshopModerationStatus\[\]/);
  assert.match(filters, /useState<WorkshopModerationStatus>\("PENDING"\)/);
});
