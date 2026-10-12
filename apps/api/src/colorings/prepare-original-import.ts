import "reflect-metadata";
import {
  mkdir,
  readFile,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import sharp from "sharp";
import { ColoringMediaService } from "./coloring-media.service";
import { currentColoringDerivativeProfile } from "./coloring-derivative-profile";
import {
  legacyPaletteHash,
  planHash,
  readBundleFile,
  sha256,
  validateOriginalImportPlan,
  type OriginalImportAsset,
  type OriginalImportEntry,
} from "./original-import-plan";

type Source = {
  sourceKey: string;
  stem: string;
  paths: { outline: string; colored: string; svg: string };
  sha256: { outline: string; colored: string; svg: string };
  dimensions: { width: number; height: number };
  colors: Array<{ symbolPosition: number; hex: string }>;
};
type PublishedColoring = {
  id: string;
  number: number;
  title: string;
  publishedRevisionId: string;
  collection: { slug: string };
  width: number;
  height: number;
  outline: { url: string; alt: string };
  colored: { alt: string };
  palette: {
    colors: Array<{
      symbolPosition: number;
      hex: string;
      markerNumber: string;
    }>;
  };
};

// Only the artwork rectangle participates: footer colours/page numbers must not
// influence matching. RMSE and a distinct runner-up gate uncertain identities.
export async function contourFingerprint(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer, {
    failOn: "warning",
    limitInputPixels: 24_000_000,
  }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 100 || height < 100 || (metadata.pages ?? 1) !== 1)
    throw new Error("Invalid contour image");
  return sharp(buffer, { failOn: "warning", limitInputPixels: 24_000_000 })
    .extract({
      left: Math.round(width * 0.065),
      top: Math.round(height * 0.038),
      width: Math.round(width * 0.86),
      height: Math.round(height * 0.865),
    })
    .flatten({ background: "white" })
    .greyscale()
    .resize(160, 224, { fit: "fill" })
    .raw()
    .toBuffer();
}
export function contourDistance(a: Buffer, b: Buffer) {
  if (!a.length || a.length !== b.length)
    throw new Error("Contour fingerprint dimensions differ");
  let squared = 0;
  for (let i = 0; i < a.length; i++) squared += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(squared / a.length) / 255;
}
export function matchOriginalContours(sources: Buffer[], published: Buffer[]) {
  if (sources.length !== published.length || sources.length < 2)
    throw new Error("Contour set coverage differs");
  const claimed = new Set<number>();
  return sources.map((source) => {
    const scores = published
      .map((reference, index) => ({
        index,
        distance: contourDistance(source, reference),
      }))
      .sort((a, b) => a.distance - b.distance);
    const best = scores[0]!;
    const runnerUp = scores[1]!.distance;
    if (
      best.distance > 0.06 ||
      runnerUp < 0.015 ||
      best.distance >= runnerUp * 0.5 ||
      claimed.has(best.index)
    )
      throw new Error(
        "Contour identity is ambiguous; review the source and published picture before importing",
      );
    claimed.add(best.index);
    return { index: best.index, distance: best.distance, runnerUp };
  });
}
function validatePublicColoring(
  value: unknown,
  slug: string,
): asserts value is PublishedColoring {
  const c = value as PublishedColoring;
  if (
    !c ||
    c.collection?.slug !== slug ||
    !/^[a-z0-9_-]{1,32}$/.test(c.id) ||
    !/^[a-z0-9_-]{1,32}$/.test(c.publishedRevisionId) ||
    !Number.isInteger(c.number) ||
    c.number < 1 ||
    c.number > 99 ||
    !Number.isInteger(c.width) ||
    !Number.isInteger(c.height) ||
    c.width < 1 ||
    c.height < 1 ||
    !c.title?.trim() ||
    !c.outline?.alt?.trim() ||
    !c.colored?.alt?.trim() ||
    !Array.isArray(c.palette?.colors) ||
    !c.palette.colors.length
  )
    throw new Error("Invalid published coloring snapshot");
  const positions = new Set<number>();
  for (const p of c.palette.colors) {
    if (
      !Number.isInteger(p.symbolPosition) ||
      p.symbolPosition < 1 ||
      p.symbolPosition > 19 ||
      positions.has(p.symbolPosition) ||
      !/^#[0-9A-F]{6}$/.test(p.hex) ||
      !/^\d{3}$/.test(p.markerNumber)
    )
      throw new Error("Invalid published palette snapshot");
    positions.add(p.symbolPosition);
  }
}
async function downloadContour(
  coloring: PublishedColoring,
  origin: string,
  cache: string,
) {
  const url = new URL(coloring.outline.url);
  const expectedPath = `/colorings/${encodeURIComponent(coloring.collection.slug)}/${String(coloring.number).padStart(2, "0")}/assets/${encodeURIComponent(coloring.publishedRevisionId)}/outline/content`;
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.pathname !== expectedPath ||
    url.search ||
    url.hash
  )
    throw new Error("Unexpected published contour URL");
  const file = join(
    cache,
    `${coloring.id}-${coloring.publishedRevisionId}.webp`,
  );
  try {
    return await readFile(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new Error(`Published contour request failed: ${response.status}`);
      const declaredSize = Number(response.headers.get("content-length"));
      if (declaredSize > 20 * 1024 * 1024)
        throw new Error("Published contour is too large");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 20 * 1024 * 1024)
        throw new Error("Published contour is too large");
      await writeFile(file, bytes, { flag: "wx" });
      return bytes;
    } catch (error) {
      if (
        attempt === 2 ||
        (error instanceof Error &&
          /too large|request failed: 4/.test(error.message))
      )
        throw error;
    }
  }
  throw new Error("Published contour download failed");
}
export async function verifySourcePalette(
  buffer: Buffer,
  colors: Source["colors"],
) {
  const { data, info } = await sharp(buffer, {
    failOn: "warning",
    limitInputPixels: 24_000_000,
  })
    .flatten({ background: "white" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    info.channels !== 3 ||
    !Array.isArray(colors) ||
    colors.length < 1 ||
    colors.length > 19
  )
    throw new Error("Invalid source palette");
  for (const [index, color] of colors.entries()) {
    if (color.symbolPosition !== index + 1 || !/^#[0-9A-F]{6}$/.test(color.hex))
      throw new Error("Invalid source palette");
    // Sample the top-left interior of the swatch, away from the outlined glyph.
    // The source archive validator requires this precise SVG footer layout.
    const x = Math.floor(((40 + 26 * index) * info.width) / 613);
    const y = Math.floor((800 * info.height) / 859);
    const offset = (y * info.width + x) * info.channels;
    const rgb = `#${data
      .subarray(offset, offset + 3)
      .toString("hex")
      .toUpperCase()}`;
    if (rgb !== color.hex)
      throw new Error(
        `SVG and PNG palette disagree at symbol ${color.symbolPosition}`,
      );
  }
}
async function preparePair(
  source: Source,
  sourceRoot: string,
  cacheRoot: string,
  media: ColoringMediaService,
) {
  const cacheKey = sha256(
    `${source.sha256.outline}:${source.sha256.colored}:${currentColoringDerivativeProfile}`,
  );
  const cache = join(cacheRoot, "derivatives", cacheKey);
  try {
    const assets = JSON.parse(
      await readFile(join(cache, "assets.json"), "utf8"),
    ) as OriginalImportEntry["assets"];
    const pair = {} as Record<
      "outline" | "colored" | "card",
      { buffer: Buffer } & OriginalImportAsset
    >;
    for (const kind of ["outline", "colored", "card"] as const) {
      const asset = assets[kind];
      if (
        asset.sourceChecksum !==
        (kind === "outline" ? source.sha256.outline : source.sha256.colored)
      )
        throw new Error("Cached derivative source differs");
      const buffer = await readBundleFile(cache, asset.file, asset.checksum);
      await media.verifyDerivative(buffer, asset);
      pair[kind] = { ...asset, buffer };
    }
    return pair;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const outline = await readBundleFile(
    sourceRoot,
    source.paths.outline,
    source.sha256.outline,
  );
  const colored = await readBundleFile(
    sourceRoot,
    source.paths.colored,
    source.sha256.colored,
  );
  const file = (buffer: Buffer, kind: string) => ({
    buffer,
    size: buffer.length,
    mimetype: "image/png",
    originalname: `${source.stem}-${kind}.png`,
  });
  const pair = await media.processPair(
    file(outline, "outline"),
    file(colored, "colored"),
  );
  const assets = {} as OriginalImportEntry["assets"];
  await mkdir(cache, { recursive: true });
  for (const kind of ["outline", "colored", "card"] as const) {
    const { buffer, ...metadata } = pair[kind];
    const file = `${kind}-${metadata.checksum}.webp`;
    await writeFile(join(cache, file), buffer);
    assets[kind] = { ...metadata, file };
  }
  await writeFile(join(cache, "assets.json"), JSON.stringify(assets));
  return pair;
}
export async function prepareOriginalImport(options: {
  sources: string;
  snapshot: string;
  output: string;
  api: string;
  cache: string;
}) {
  const sourceRoot = resolve(options.sources);
  const rawManifest = await readFile(join(sourceRoot, "manifest.json"));
  if (rawManifest.length > 2 * 1024 * 1024)
    throw new Error("Source manifest is too large");
  const manifest = JSON.parse(rawManifest.toString()) as {
    version: number;
    collections: Array<{ slug: string; sources: Source[] }>;
  };
  if (
    manifest.version !== 1 ||
    !Array.isArray(manifest.collections) ||
    !manifest.collections.length ||
    manifest.collections.length > 14 ||
    new Set(manifest.collections.map((c) => c.slug)).size !==
      manifest.collections.length
  )
    throw new Error("Invalid source manifest");
  const rawSnapshot = await readFile(options.snapshot);
  if (rawSnapshot.length > 8 * 1024 * 1024)
    throw new Error("Published snapshot is too large");
  const snapshot = JSON.parse(rawSnapshot.toString()) as unknown[];
  if (!Array.isArray(snapshot)) throw new Error("Invalid published snapshot");
  const api = new URL(options.api);
  if (
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    api.pathname !== "/" ||
    (api.origin !== "https://api.artmate.ru" &&
      !(
        api.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)
      ))
  )
    throw new Error("Use the public Artmate API or an explicit local fixture");
  const output = resolve(options.output);
  const staging = `${output}.staging-${process.pid}`;
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  const cache = resolve(options.cache);
  const pending: Array<{
    source: Source;
    coloring: PublishedColoring;
    match: { distance: number; runnerUp: number };
    legacyOutlineChecksum: string;
  }> = [];
  const entries: OriginalImportEntry[] = [];
  const media = new ColoringMediaService();
  try {
    await mkdir(staging);
    await mkdir(cache, { recursive: true });
    // Finish all identity and palette checks before encoding any files.
    for (const collection of manifest.collections) {
      if (
        !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(collection.slug) ||
        !Array.isArray(collection.sources) ||
        collection.sources.length !== 25
      )
        throw new Error("Expected 25 original sources per collection");
      const published = snapshot.filter(
        (x: unknown) =>
          (x as PublishedColoring)?.collection?.slug === collection.slug,
      );
      if (published.length !== 25)
        throw new Error(
          `Published collection coverage differs: ${collection.slug}`,
        );
      for (const c of published) validatePublicColoring(c, collection.slug);
      const records = published as PublishedColoring[];
      if (
        new Set(records.map((c) => c.id)).size !== 25 ||
        new Set(records.map((c) => c.number)).size !== 25
      )
        throw new Error("Duplicate published identities");
      const originals: Array<{ source: Source; fingerprint: Buffer }> = [];
      for (const source of collection.sources) {
        const outline = await readBundleFile(
          sourceRoot,
          source.paths.outline,
          source.sha256.outline,
        );
        const colored = await readBundleFile(
          sourceRoot,
          source.paths.colored,
          source.sha256.colored,
        );
        await readBundleFile(sourceRoot, source.paths.svg, source.sha256.svg);
        await verifySourcePalette(outline, source.colors);
        await verifySourcePalette(colored, source.colors);
        originals.push({
          source,
          fingerprint: await contourFingerprint(outline),
        });
      }
      const references: Array<{ data: Buffer; fingerprint: Buffer }> = [];
      for (let start = 0; start < records.length; start += 4) {
        references.push(
          ...(await Promise.all(
            records.slice(start, start + 4).map(async (c) => {
              const data = await downloadContour(c, api.origin, cache);
              return { data, fingerprint: await contourFingerprint(data) };
            }),
          )),
        );
      }
      const matches = matchOriginalContours(
        originals.map((s) => s.fingerprint),
        references.map((s) => s.fingerprint),
      );
      for (let i = 0; i < originals.length; i++) {
        const source = originals[i]!.source;
        const match = matches[i]!;
        const coloring = records[match.index]!;
        if (
          source.dimensions.width !== coloring.width ||
          source.dimensions.height !== coloring.height
        )
          throw new Error(`Original geometry differs: ${coloring.id}`);
        const expectedPositions = coloring.palette.colors
          .map((p) => p.symbolPosition)
          .sort((a, b) => a - b);
        if (
          JSON.stringify(source.colors.map((p) => p.symbolPosition)) !==
          JSON.stringify(expectedPositions)
        )
          throw new Error(`Original symbol positions differ: ${coloring.id}`);
        pending.push({
          source,
          coloring,
          match: { distance: match.distance, runnerUp: match.runnerUp },
          legacyOutlineChecksum: sha256(references[match.index]!.data),
        });
      }
      process.stdout.write(
        `${collection.slug}: ${originals.length} originals matched; both PNG palettes verified\n`,
      );
    }
    for (let start = 0; start < pending.length; start += 2) {
      await Promise.all(
        pending
          .slice(start, start + 2)
          .map(
            async ({ source, coloring: c, match, legacyOutlineChecksum }) => {
              const pair = await preparePair(source, sourceRoot, cache, media);
              const assets = {} as OriginalImportEntry["assets"];
              await mkdir(join(staging, c.id));
              for (const kind of ["outline", "colored", "card"] as const) {
                const { buffer, ...metadata } = pair[kind];
                const relativeFile = `${c.id}/${kind}-${metadata.checksum}.webp`;
                await writeFile(join(staging, relativeFile), buffer, {
                  flag: "wx",
                });
                assets[kind] = {
                  ...metadata,
                  file: relativeFile,
                } satisfies OriginalImportAsset;
              }
              entries.push({
                coloringId: c.id,
                collectionSlug: c.collection.slug,
                number: c.number,
                title: c.title,
                publishedRevisionId: c.publishedRevisionId,
                legacyOutlineChecksum,
                legacyPaletteHash: legacyPaletteHash(c.palette.colors),
                outlineAlt: c.outline.alt,
                imageAlt: c.colored.alt,
                sourceKey: source.sourceKey,
                match,
                colors: source.colors,
                assets,
              });
            },
          ),
      );
      if ((start + 2) % 10 === 0 || start + 2 >= pending.length)
        process.stdout.write(
          `Derivatives verified: ${Math.min(start + 2, pending.length)}/${pending.length}\n`,
        );
    }
    entries.sort(
      (a, b) =>
        a.collectionSlug.localeCompare(b.collectionSlug) || a.number - b.number,
    );
    const body = {
      schemaVersion: 1 as const,
      derivativeProfile: currentColoringDerivativeProfile,
      sourceManifestChecksum: sha256(rawManifest),
      entries,
    };
    const plan = { ...body, planHash: planHash(body) };
    validateOriginalImportPlan(plan);
    await writeFile(join(staging, "plan.json"), JSON.stringify(plan, null, 2));
    await rmdir(output);
    await rename(staging, output);
    return plan;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 10)
    throw new Error(
      "Usage: prepare-original-import --sources DIR --snapshot FILE --output DIR --api URL --cache DIR",
    );
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]!;
    if (
      !["--sources", "--snapshot", "--output", "--api", "--cache"].includes(
        key,
      ) ||
      parsed[key]
    )
      throw new Error("Invalid preparation arguments");
    parsed[key] = args[i + 1]!;
  }
  if (Object.keys(parsed).length !== 5)
    throw new Error("Missing preparation arguments");
  const plan = await prepareOriginalImport({
    sources: parsed["--sources"]!,
    snapshot: parsed["--snapshot"]!,
    output: parsed["--output"]!,
    api: parsed["--api"]!,
    cache: parsed["--cache"]!,
  });
  process.stdout.write(
    `Ready: ${plan.entries.length} originals; confirmation ${plan.planHash}\n`,
  );
}
if (require.main === module)
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Original preparation failed"}\n`,
    );
    process.exitCode = 1;
  });
