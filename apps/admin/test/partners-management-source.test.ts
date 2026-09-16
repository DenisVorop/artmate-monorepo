import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const managementSource = await readFile(
  new URL(
    "../src/features/partners-management/ui/partners-management.tsx",
    import.meta.url,
  ),
  "utf8",
);
const mutationSource = await readFile(
  new URL(
    "../src/features/partners-management/model/use-save-affiliate-partner.ts",
    import.meta.url,
  ),
  "utf8",
);

test("dialog pending state resets synchronously before successful close and on open", () => {
  assert.match(
    managementSource,
    /setFormPending\(false\);\s*setDialog\(\{ open: false \}\)/,
  );
  assert.match(
    managementSource,
    /setFormPending\(false\);\s*setDialog\(\{ open: true(?:, userId: partner\.userId)? \}\)/,
  );
});

test("saving a partner invalidates affiliate partner and users caches", () => {
  assert.match(mutationSource, /affiliatePartnersQueryKeys\.all/);
  assert.match(mutationSource, /usersQueryKeys\.all/);
});
