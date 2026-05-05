import type { SeoEntry, SeoSnapshot } from "../model";

export function getSeoEntryDisplayTitle(entry: SeoEntry) {
  return entry.path;
}

export function getSeoEntrySnapshot(entry: SeoEntry) {
  return entry.draftSnapshot ?? entry.publishedSnapshot;
}

export function formatSeoSnapshotTitle(snapshot: SeoSnapshot) {
  return `v${snapshot.version} · ${getSeoSnapshotKindLabel(snapshot.kind)}`;
}

export function getSeoSnapshotKindLabel(kind: SeoSnapshot["kind"]) {
  switch (kind) {
    case "draft":
      return "Черновик";
    case "published":
      return "Опубликован";
    case "archived":
      return "Архив";
  }
}

export function getSeoStatusLabel(status: SeoEntry["status"]) {
  switch (status) {
    case "draft":
      return "Черновик";
    case "published":
      return "Опубликовано";
    case "archived":
      return "Архив";
  }
}
