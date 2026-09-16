import assert from "node:assert/strict";
import test from "node:test";

import { getUpdatedUserRoles } from "../src/features/users-management/lib/role-mapping.ts";

test("role editor preserves the original partner membership", () => {
  assert.deepEqual(getUpdatedUserRoles(["customer", "partner"], ["admin"]), [
    "admin",
    "partner",
  ]);
});

test("role editor does not grant partner membership", () => {
  assert.deepEqual(getUpdatedUserRoles(["customer"], ["admin"]), ["admin"]);
});

test("current admin role is preserved without duplicating roles", () => {
  assert.deepEqual(
    getUpdatedUserRoles(["admin", "partner"], ["customer", "admin"], true),
    ["customer", "admin", "partner"],
  );
});
