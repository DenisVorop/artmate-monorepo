import { createHash } from "node:crypto";

export function quoteStrongEtag(opaqueTag: string) {
  return `"${opaqueTag}"`;
}

export function createNamespacedStrongEtag(
  namespace: string,
  content: Buffer | string,
) {
  const opaqueTag = createHash("sha256")
    .update(namespace)
    .update("\0")
    .update(content)
    .digest("hex");

  return quoteStrongEtag(opaqueTag);
}

export function matchesIfNoneMatch(
  header: string | undefined,
  currentEtag: string,
) {
  if (!header) {
    return false;
  }

  const tags = splitEntityTags(header);

  if (tags.includes("*")) {
    return true;
  }

  const currentOpaqueTag = getOpaqueTag(currentEtag);

  return Boolean(
    currentOpaqueTag &&
    tags.some((tag) => getOpaqueTag(tag) === currentOpaqueTag),
  );
}

function splitEntityTags(header: string) {
  const tags: string[] = [];
  let start = 0;
  let quoted = false;

  for (let index = 0; index < header.length; index += 1) {
    if (header[index] === '"') {
      quoted = !quoted;
    } else if (header[index] === "," && !quoted) {
      tags.push(header.slice(start, index).trim());
      start = index + 1;
    }
  }

  tags.push(header.slice(start).trim());
  return tags;
}

function getOpaqueTag(tag: string) {
  return /^(?:W\/)?("[\x21\x23-\x7e\x80-\xff]*")$/.exec(tag)?.[1];
}
