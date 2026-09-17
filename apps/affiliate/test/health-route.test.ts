import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

test("returns only a non-cacheable public health status", async () => {
  const routeUrl = new URL("../app/health/route.ts", import.meta.url);

  assert.equal(existsSync(routeUrl), true, "health route must exist");

  const { GET } = await import(routeUrl.href);
  const response = GET();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ok" });
});
