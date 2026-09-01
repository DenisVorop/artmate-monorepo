import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("workshop and club routes are canonical and club metadata is noindex,follow", async () => {
  const routes = await readSource("src/shared/constants/routes.ts");
  const publicWorkshopRoute = await readSource("app/(site)/club/[handle]/page.tsx");
  const publicWorkRoute = await readSource("app/(site)/club/works/[publicId]/page.tsx");

  assert.match(routes, /workshop: "\/account\/workshop"/);
  assert.match(routes, /`\/account\/workshop\/\$\{collectionSlug\}`/);
  assert.match(routes, /`\/club\/\$\{handle\}`/);
  assert.match(routes, /`\/club\/works\/\$\{publicId\}`/);

  for (const source of [publicWorkshopRoute, publicWorkRoute]) {
    assert.match(source, /robots: \{ index: false, follow: true \}/);
    assert.match(source, /notFound\(\)/);
    assert.match(source, /HydrationBoundary/);
    assert.match(source, /dehydrateQueryClient\(queryClient\)/);
  }

  assert.match(publicWorkRoute, /CommunityDataBuilder[\s\S]*\.withRelatedWorks/);
  assert.doesNotMatch(publicWorkRoute, /prefetchQuery/);
});

test("owner routes are session-aware bindings and editor uses canonical numbers", async () => {
  const overview = await readSource("app/(site)/account/workshop/page.tsx");
  const collection = await readSource("app/(site)/account/workshop/[collectionSlug]/page.tsx");
  const editor = await readSource("app/(site)/account/workshop/[collectionSlug]/[number]/page.tsx");

  for (const source of [overview, collection, editor]) {
    assert.match(source, /getAuthSession\(\)/);
    assert.match(source, /redirect\(`\$\{routes\.auth\}\?next=/);
    assert.match(source, /dehydrateQueryClient\(queryClient\)/);
    assert.doesNotMatch(source, /useQuery|useMutation|<main/);
  }

  assert.match(editor, /parseColoringNumber\(numberSegment\)/);
  assert.match(editor, /\.withColoring\(collectionSlug, number\)/);
  assert.match(editor, /\.withTools\(\)/);
  assert.match(editor, /\.withMarkerColors\(\)/);
});

test("club routes never enter sitemap and no global club feed exists", async () => {
  const sitemap = await readSource("app/sitemap.ts");

  assert.doesNotMatch(sitemap, /routes\.publicWorkshop|routes\.publicWork|\/club/);

  await assert.rejects(
    () => readFile(new URL("../app/(site)/club/page.tsx", import.meta.url), "utf8"),
    (error) => error.code === "ENOENT",
  );
});

test("FSD keeps route UI, query state, transport and editor responsibilities separated", async () => {
  const page = await readSource("src/_pages/work-editor/index.tsx");
  const feature = await readSource("src/features/work-editor/ui/work-editor.tsx");
  const actions = await readSource("src/shared/actions/workshops/workshops.actions.ts");
  const workshopBuilder = await readSource("src/_app/lib/workshop-data-builder.ts");
  const communityBuilder = await readSource("src/_app/lib/community-data-builder.ts");
  const coloringDetails = await readSource("src/features/coloring-details/ui/coloring-details.tsx");
  const publicWork = await readSource("src/features/public-work/ui/public-work.tsx");

  assert.doesNotMatch(page, /useQuery|useMutation|shared\/actions/);
  assert.match(page, /<WorkEditor slug=\{slug\} number=\{number\}/);
  assert.match(feature, /useForm<WorkEditorFormValues>/);
  assert.match(feature, /useWorkshopColoringData/);
  assert.doesNotMatch(actions, /@\/features|@\/entities|revalidatePath/);
  assert.match(workshopBuilder, /queryClient\.fetchQuery/);
  assert.match(communityBuilder, /fetchOrNull/);
  assert.doesNotMatch(coloringDetails, /@\/features\//);
  assert.doesNotMatch(publicWork, /@\/features\//);
});
