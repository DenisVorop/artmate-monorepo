import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { ProcessedColoringAsset } from "./coloring-media.service";
import { currentColoringDerivativeProfile } from "./coloring-derivative-profile";

export type OriginalImportAsset = Omit<ProcessedColoringAsset, "buffer"> & {
  file: string;
};
export type OriginalImportEntry = {
  coloringId: string;
  collectionSlug: string;
  number: number;
  title: string;
  publishedRevisionId: string;
  legacyOutlineChecksum: string;
  legacyPaletteHash: string;
  outlineAlt: string;
  imageAlt: string;
  sourceKey: string;
  match: { distance: number; runnerUp: number };
  colors: Array<{ symbolPosition: number; hex: string }>;
  assets: {
    outline: OriginalImportAsset;
    colored: OriginalImportAsset;
    card: OriginalImportAsset;
  };
};
export type OriginalImportPlan = {
  schemaVersion: 1;
  derivativeProfile: typeof currentColoringDerivativeProfile;
  sourceManifestChecksum: string;
  entries: OriginalImportEntry[];
  planHash: string;
};
export function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}
export function planHash(plan: Omit<OriginalImportPlan, "planHash">) {
  return sha256(JSON.stringify(plan));
}
export function legacyPaletteHash(
  colors: Array<{ symbolPosition: number; hex: string; markerNumber: string }>,
) {
  return sha256(
    JSON.stringify(
      colors
        .map(({ symbolPosition, hex, markerNumber }) => ({
          symbolPosition,
          hex: hex.toUpperCase(),
          markerNumber,
        }))
        .sort((a, b) => a.symbolPosition - b.symbolPosition),
    ),
  );
}
export async function readBundleFile(
  root: string,
  file: string,
  checksum: string,
  limit = 20 * 1024 * 1024,
) {
  if (
    typeof file !== "string" ||
    isAbsolute(file) ||
    !file ||
    file.includes("\\")
  )
    throw new Error("Unsafe import file path");
  const base = await realpath(root);
  const path = resolve(base, file);
  const inside = relative(base, path);
  if (
    !inside ||
    inside === ".." ||
    inside.startsWith(`..${sep}`) ||
    isAbsolute(inside)
  )
    throw new Error("Unsafe import file path");
  const stat = await lstat(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size <= 0 ||
    stat.size > limit ||
    (await realpath(path)) !== path
  )
    throw new Error("Import file is missing, too large or linked");
  const data = await readFile(path);
  if (
    data.length > limit ||
    !/^[a-f0-9]{64}$/.test(checksum) ||
    sha256(data) !== checksum
  )
    throw new Error("Import file checksum mismatch");
  return data;
}
export function validateOriginalImportPlan(
  value: unknown,
): asserts value is OriginalImportPlan {
  const p = value as OriginalImportPlan;
  if (
    !p ||
    p.schemaVersion !== 1 ||
    p.derivativeProfile !== currentColoringDerivativeProfile ||
    !/^[a-f0-9]{64}$/.test(p.sourceManifestChecksum) ||
    !Array.isArray(p.entries) ||
    p.entries.length < 1 ||
    p.entries.length > 350
  )
    throw new Error("Invalid original import plan");
  const { planHash: suppliedHash, ...body } = p;
  if (suppliedHash !== planHash(body))
    throw new Error("Import plan hash mismatch");
  const identities = new Set<string>();
  const routes = new Set<string>();
  for (const e of p.entries) {
    if (
      !e ||
      !/^[a-z0-9_-]{1,32}$/.test(e.coloringId) ||
      !/^[a-z0-9_-]{1,32}$/.test(e.publishedRevisionId) ||
      !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.collectionSlug) ||
      !Number.isInteger(e.number) ||
      e.number < 1 ||
      e.number > 99 ||
      !/^[a-f0-9]{64}$/.test(e.legacyOutlineChecksum) ||
      !/^[a-f0-9]{64}$/.test(e.legacyPaletteHash)
    )
      throw new Error("Invalid original import identity");
    const route = `${e.collectionSlug}/${e.number}`;
    if (identities.has(e.coloringId) || routes.has(route))
      throw new Error("Duplicate original import identity");
    identities.add(e.coloringId);
    routes.add(route);
    if (
      [e.title, e.outlineAlt, e.imageAlt, e.sourceKey].some(
        (s) => typeof s !== "string" || !s.trim() || s.length > 220,
      )
    )
      throw new Error("Invalid original import labels");
    if (
      !e.match ||
      !Number.isFinite(e.match.distance) ||
      !Number.isFinite(e.match.runnerUp) ||
      e.match.distance < 0 ||
      e.match.distance > 0.06 ||
      e.match.runnerUp < 0.015 ||
      e.match.distance >= e.match.runnerUp * 0.5
    )
      throw new Error("Ambiguous original match");
    if (
      !Array.isArray(e.colors) ||
      e.colors.length < 1 ||
      e.colors.length > 19 ||
      e.colors.some(
        (c, i) => c.symbolPosition !== i + 1 || !/^#[0-9A-F]{6}$/.test(c.hex),
      )
    )
      throw new Error("Invalid original palette");
    for (const kind of ["outline", "colored", "card"] as const) {
      const a = e.assets?.[kind];
      if (
        !a ||
        typeof a.file !== "string" ||
        !/^[a-f0-9]{64}$/.test(a.checksum) ||
        !/^[a-f0-9]{64}$/.test(a.sourceChecksum) ||
        !["image/png", "image/webp"].includes(a.sourceMime) ||
        !Number.isInteger(a.byteSize) ||
        a.byteSize <= 0 ||
        a.byteSize > 20 * 1024 * 1024 ||
        !Number.isInteger(a.width) ||
        !Number.isInteger(a.height) ||
        a.width < 1 ||
        a.height < 1 ||
        a.width > (kind === "card" ? 640 : 4096) ||
        a.height > (kind === "card" ? 640 : 4096)
      )
        throw new Error("Invalid original derivative");
    }
    if (
      e.assets.outline.width !== e.assets.colored.width ||
      e.assets.outline.height !== e.assets.colored.height ||
      e.assets.outline.checksum === e.assets.colored.checksum
    )
      throw new Error("Invalid original image pair");
  }
}
