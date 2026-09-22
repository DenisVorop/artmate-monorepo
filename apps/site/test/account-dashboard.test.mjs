import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
test("dashboard stacks a loyalty card and single-row scrollable previews", async () => {
  const page = await source("src/_pages/account/index.tsx");
  assert.match(page, /<AccountClubPreview \/>\s*<AchievementGallery preview \/>\s*<AccountWorkshopPreview \/>/);
  const rail = await source("src/shared/ui/horizontal-rail.tsx");
  assert.match(rail, /grid-flow-col/);
  assert.match(rail, /overflow-x-auto/);
  assert.match(rail, /overscroll-x-contain/);
  assert.match(rail, /max-md:w-screen/);
  assert.match(rail, /max-md:-ml-\[50vw\]/);
  assert.match(rail, /max-md:rounded-none/);
  assert.match(rail, /max-md:px-4/);
  assert.match(rail, /max-md:scroll-px-4/);
  assert.match(rail, /tabIndex=\{0\}/);
  assert.match(rail, /aria-label=\{label\}/);
  assert.match(await source("src/features/achievements/ui/achievement-gallery.tsx"), /<HorizontalRail label="Лента достижений"/);
  assert.match(await source("src/features/account/ui/workshop-preview.tsx"), /<HorizontalRail label="Лента мастерской"/);
  const club = await source("src/features/account/ui/club-preview.tsx");
  assert.doesNotMatch(club, /Карта лояльности|Ваша карта творчества|availablePoints \* 20/);
  assert.match(club, /max-w-md/);
  assert.match(club, /aspect-\[1\.7\]/);
  assert.match(club, /availablePoints/);
  assert.match(club, /href=\{routes.loyalty\}/);
});

test("achievements are a separate account section, not part of the club page", async () => {
  const cabinet = await source("src/features/loyalty-cabinet/ui/loyalty-cabinet.tsx");
  const enrollment = await source("src/features/loyalty-cabinet/ui/enrollment.tsx");
  const route = await source("app/(site)/account/club/page.tsx");
  assert.doesNotMatch(cabinet, /Achievements|AchievementGallery|dashboard\.data\.achievements|достижен/i);
  assert.doesNotMatch(enrollment + route, /достижен/i);
  assert.match(cabinet, /<Balance /);
  assert.match(cabinet, /<Operations /);
  assert.match(await source("src/_pages/account/index.tsx"), /<AchievementGallery preview/);
});

async function load(path, mocks) {
  const code = ts.transpileModule(await source(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => mocks[name] ?? require(name),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

test("order pages are user-scoped and fetch only the requested range", async () => {
  const calls = [];
  const { ordersQuery } = await load("src/entities/orders/model/query.ts", {
    "@/shared/actions/orders": {
      getMyOrders: async (...args) => {
        calls.push(args);
        return [{ id: "order" }];
      },
    },
    "@/shared/lib/api-result": { ApiResult: { fromDTO: (value) => ({ unwrap: () => value }) } },
  });
  assert.notDeepEqual(
    ordersQuery.getMyOrders("alice", 3).queryKey,
    ordersQuery.getMyOrders("bob", 3).queryKey,
  );
  assert.notDeepEqual(
    ordersQuery.getMyOrders("alice", 11, 0).queryKey,
    ordersQuery.getMyOrders("alice", 11, 10).queryKey,
  );
  const signal = new AbortController().signal;
  await ordersQuery.getMyOrders("alice", 3).queryFn({ signal });
  await ordersQuery.getMyOrders("alice", 11, 10).queryFn({ signal });
  assert.deepEqual(calls, [
    [3, 0],
    [11, 10],
  ]);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(ordersQuery.getMyOrders("alice", 3).queryFn({ signal: cancelled.signal }));
});

test("account routes are private and page slices only compose features", async () => {
  for (const segment of ["", "/orders", "/settings", "/achievements"]) {
    const route = await source(`app/(site)/account${segment}/page.tsx`);
    assert.match(route, /getAuthSession/);
    assert.match(route, /redirect\(/);
    assert.match(route, /index: false/);
  }
  for (const page of ["account", "account-orders", "account-settings", "account-achievements"]) {
    assert.doesNotMatch(
      await source(`src/_pages/${page}/index.tsx`),
      /useQuery|useMutation|useOrdersData|useSession|shared\/actions/,
    );
  }
});

test("dashboard does not enrol, award, or create a workshop on view", async () => {
  const preview = await source("src/features/account/ui/club-preview.tsx");
  const builder = await source("src/_app/lib/account-data-builder.ts");
  assert.doesNotMatch(
    preview + builder,
    /useEnroll|acceptedTerms|useMutation|getMyWorkshop|workshopQuery\.owner/,
  );
  assert.match(preview, /availablePoints/);
  const card = await source("src/entities/achievement/ui/achievement-card.tsx");
  assert.match(card, /grayscale/);
  assert.match(card, /earnedAt/);
  assert.match(card, /ResponsiveMediaViewer/);
  assert.match(builder, /workshopQuery\.preview\(userId\)/);
  assert.match(preview, /historyState === "ready"/);
  assert.match(preview, /бонусами/);
});

test("settings preserve Telegram and dashboard preserves welcome promo", async () => {
  const settings = await source("src/features/account/ui/settings.tsx");
  const page = await source("src/_pages/account/index.tsx");
  assert.match(settings, /TelegramLinkCard/);
  assert.match(settings, /useForm<TelegramLinkFormValues>/);
  assert.match(page, /AccountWelcomePromo/);
  assert.match(page, /AccountOrders preview/);
  assert.doesNotMatch(settings, /accountOrders\.map/);
});

test("achievement preview prioritizes awards and progress without changing server order", async () => {
  const { getAchievementPreview } = await load(
    "src/entities/achievement/lib/achievement-selectors.ts",
    {},
  );
  const items = Object.freeze([
    { id: "slow", earnedAt: null, progress: 1, target: 10 },
    { id: "first-tie", earnedAt: null, progress: 2, target: 5 },
    { id: "awarded", earnedAt: "2026-09-22", progress: 0, target: 10 },
    { id: "second-tie", earnedAt: null, progress: 4, target: 10 },
    { id: "not-awarded", earnedAt: null, progress: 5, target: 5 },
  ]);
  assert.deepEqual(
    getAchievementPreview(items, 4).map((item) => item.id),
    ["awarded", "not-awarded", "first-tie", "second-tie"],
  );
  assert.equal(items[0].id, "slow");
  const { filterAchievements } = await load(
    "src/features/achievements/lib/achievement-state.ts",
    {},
  );
  assert.deepEqual(
    filterAchievements(items, "earned").map((item) => item.id),
    ["awarded"],
  );
  assert.equal(filterAchievements(items, "upcoming").length, 4);
  assert.equal(filterAchievements(items, "all").length, 5);
});

test("workshop preview uses a separate user cache and refuses late responses after logout", async () => {
  const { workshopQuery } = await load("src/entities/workshop/model/query.ts", {
    "@/shared/actions/workshops": { getMyWorkshopPreview: async () => ({ collections: [] }) },
    "@/shared/lib/api-result": { ApiResult: { fromDTO: (value) => ({ unwrap: () => value }) } },
    "./schemas": { workshopPreviewSchema: { parse: (value) => value } },
  });
  assert.notDeepEqual(
    workshopQuery.preview("alice").queryKey,
    workshopQuery.preview("bob").queryKey,
  );
  assert.deepEqual(
    await workshopQuery.preview("alice").queryFn({ signal: new AbortController().signal }),
    { collections: [] },
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(workshopQuery.preview("alice").queryFn({ signal: controller.signal }));
  const card = await source("src/entities/workshop/ui/collection-card.tsx");
  assert.match(card, /aspect-\[3\/4\]/);
  assert.match(card, /object-contain/);
  assert.doesNotMatch(card, /object-cover|group-hover:scale/);
});
