import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
async function load(path, mocks = {}) {
  const source = await readFile(new URL("../" + path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)((id) => mocks[id], mod, mod.exports);
  return mod.exports;
}

test("SEO gallery pages only seed filters; explicit query choices and reset override the preset", async () => {
  const { readGalleryFilters, getGalleryParams } = await load(
    "src/features/community-gallery/lib/gallery-state.ts",
  );
  const preset = "cifrovaya-raskraska-kotiki-2";
  assert.deepEqual(readGalleryFilters({}, preset), { collections: [preset], number: undefined });
  assert.deepEqual(
    readGalleryFilters({ album: ["flowers", "cats", "cats"], picture: "24" }, preset),
    { collections: ["cats", "flowers"], number: 24 },
  );
  assert.deepEqual(readGalleryFilters(getGalleryParams({ collections: [] }), preset), {
    collections: [],
    number: undefined,
  });
  assert.deepEqual(readGalleryFilters({ picture: "100", album: ["bad/slug", "cats"] }), {
    collections: ["cats"],
    number: undefined,
  });
  const params = getGalleryParams({ collections: ["flowers", "cats"], number: 3 });
  assert.deepEqual(readGalleryFilters(params, preset), {
    collections: ["cats", "flowers"],
    number: 3,
  });
});

test("gallery pages keep distinct caches and send both filters with every cursor", async () => {
  const requests = [];
  const { communityWorkQuery } = await load("src/entities/community-work/model/query.ts", {
    "@tanstack/react-query": {
      queryOptions: (value) => value,
      infiniteQueryOptions: (value) => value,
    },
    "@/shared/actions/workshops": {
      getCommunityGalleryWorks: async (cursor, filters) => {
        requests.push({ cursor, filters });
        return { works: [], nextCursor: null };
      },
    },
    "@/shared/lib/api-result": { ApiResult: { fromDTO: (value) => ({ unwrap: () => value }) } },
    "./schemas": { galleryWorksPageSchema: { parse: (value) => value } },
  });
  const filters = { collections: ["cifrovaya-raskraska-kotiki-2", "flowers"], number: 17 };
  const query = communityWorkQuery.gallery(filters);
  assert.notDeepEqual(query.queryKey, communityWorkQuery.gallery().queryKey);
  assert.notDeepEqual(
    query.queryKey,
    communityWorkQuery.gallery({ collections: filters.collections }).queryKey,
  );
  assert.deepEqual(
    query.queryKey,
    communityWorkQuery.gallery({ collections: [...filters.collections].reverse(), number: 17 })
      .queryKey,
  );
  await query.queryFn({ pageParam: undefined });
  await query.queryFn({ pageParam: "next-page" });
  assert.deepEqual(requests, [
    { cursor: undefined, filters },
    { cursor: "next-page", filters },
  ]);
  assert.equal(query.getNextPageParam({ nextCursor: "next-page" }), "next-page");
  assert.equal(query.getNextPageParam({ nextCursor: null }), undefined);
});
