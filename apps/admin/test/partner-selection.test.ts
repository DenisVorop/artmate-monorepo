import assert from "node:assert/strict";
import test from "node:test";

import { collectAffiliatePartnerSelection } from "../src/entities/affiliate-partners/model/selection.ts";
import { collectPartnerApplicationSelection } from "../src/entities/partner-applications/model/selection.ts";
import { getAffiliatePartnerCandidates } from "../src/features/partners-management/lib/partner-candidates.ts";

test("partner candidates include only active users without an existing profile", () => {
  const users = [
    { id: "available", status: "active" as const },
    { id: "existing-active", status: "active" as const },
    { id: "existing-suspended", status: "active" as const },
    { id: "blocked", status: "blocked" as const },
    { id: "deleted", status: "deleted" as const },
  ];

  assert.deepEqual(
    getAffiliatePartnerCandidates(users, [
      { userId: "existing-active" },
      { userId: "existing-suspended" },
    ]).map(({ id }) => id),
    ["available"],
  );
});

test("affiliate partner selection reads every page with pageSize 25", async () => {
  const requestedPages: number[] = [];
  const items = await collectAffiliatePartnerSelection(
    async ({ page, pageSize }) => {
      requestedPages.push(page);
      return {
        items: [{ userId: `user-${page}` }],
        page,
        pageSize,
        total: 51,
      };
    },
  );

  assert.deepEqual(requestedPages, [1, 2, 3]);
  assert.deepEqual(
    items.map(({ userId }) => userId),
    ["user-1", "user-2", "user-3"],
  );
});

test("partner application selection aggregates all response pages", async () => {
  const requested: Array<{ page: number; pageSize: number }> = [];
  const items = await collectPartnerApplicationSelection(async (params) => {
    requested.push(params);
    return {
      items: [{ id: `application-${params.page}` }],
      page: params.page,
      pageSize: 40,
      total: 81,
      totalPages: 3,
    };
  });

  assert.deepEqual(requested, [
    { page: 1, pageSize: 100 },
    { page: 2, pageSize: 40 },
    { page: 3, pageSize: 40 },
  ]);
  assert.deepEqual(
    items.map(({ id }) => id),
    ["application-1", "application-2", "application-3"],
  );
});

test("selection aggregation stops when an API repeats a page", async () => {
  let calls = 0;
  const items = await collectPartnerApplicationSelection(async ({ page }) => {
    calls += 1;
    return {
      items: [{ id: `application-${page}` }],
      page: 1,
      pageSize: 100,
      total: 500,
      totalPages: 5,
    };
  });

  assert.equal(calls, 2);
  assert.equal(items.length, 1);
});
