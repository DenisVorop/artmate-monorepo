import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const routes = read("../src/shared/constants/routes.ts");
const shell = read("../src/widgets/admin-shell/ui/admin-shell.tsx");
const queueRoute = read("../app/workshop-moderation/page.tsx");
const detailRoute = read("../app/workshop-moderation/[revisionId]/page.tsx");
const rootLayout = read("../src/_app/layouts/root-layout.tsx");

test("workshop moderation routes and sidebar navigation are registered", () => {
  assert.match(routes, /workshopModeration: "\/workshop-moderation"/);
  assert.match(routes, /workshopModerationRevision: \(revisionId: string\)/);
  assert.match(shell, /label: "Модерация работ"/);
  assert.match(shell, /href: routes\.workshopModeration/);
});

test("queue route owns metadata, session guard and pending hydration", () => {
  assert.match(queueRoute, /export const metadata: Metadata/);
  assert.match(queueRoute, /getAdminSession\(\)/);
  assert.match(queueRoute, /redirect\(/);
  assert.match(queueRoute, /workshopModerationQuery\.queue\("PENDING"\)/);
  assert.match(queueRoute, /HydrationBoundary/);
  assert.match(queueRoute, /dehydrateQueryClient\(queryClient\)/);
});

test("detail route fetches exact revision and returns notFound for 404", () => {
  assert.match(detailRoute, /export const metadata: Metadata/);
  assert.match(detailRoute, /getAdminSession\(\)/);
  assert.match(detailRoute, /workshopModerationQuery\.detail\(revisionId\)/);
  assert.match(detailRoute, /isWorkshopModerationNotFoundError\(error\)/);
  assert.match(detailRoute, /notFound\(\)/);
  assert.match(detailRoute, /HydrationBoundary/);
});

test("admin remains globally noindex and nofollow", () => {
  assert.match(rootLayout, /robots:\s*\{[\s\S]*index: false/);
  assert.match(rootLayout, /follow: false/);
});
