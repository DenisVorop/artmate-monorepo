import type { EntryLegalAcceptance } from "./legal/contest-consent";
import { Prisma } from "../generated/prisma/client";

export const contestEntryInclude = {
  contest: true,
  user: { select: { id: true, name: true, email: true } },
  revisions: {
    orderBy: { sequence: "desc" as const },
    take: 1,
    include: {
      product: {
        include: {
          category: true,
          coloringCollection: { select: { slug: true } },
        },
      },
    },
  },
  events: {
    orderBy: { version: "desc" as const },
    include: { actor: { select: { name: true } } },
  },
} satisfies Prisma.ContestEntryInclude;
export type ContestEntryRecord = Prisma.ContestEntryGetPayload<{
  include: typeof contestEntryInclude;
}>;
export const publicContestEntryWhere = () =>
  ({
    OR: [
      { publicationEndsAt: null },
      { publicationEndsAt: { gt: new Date() } },
    ],
    status: "APPROVED",
    publishedAt: { not: null },
    contest: { is: { published: true } },
    user: { is: { status: "ACTIVE", deletedAt: null } },
  }) satisfies Prisma.ContestEntryWhereInput;
export function contestPhotoUrl(
  publicId: string,
  variant: "web" | "thumb" = "web",
) {
  const base = (process.env.API_PUBLIC_URL ?? "http://localhost:3002").replace(
    /\/+$/,
    "",
  );
  return `${base}/contests/works/${publicId}/photo/${variant}`;
}
function publishedValues(entry: ContestEntryRecord) {
  const revision = entry.revisions[0]!;
  const acceptance = revision.publicationSnapshot as unknown as
    | EntryLegalAcceptance["publication"]
    | null;
  return {
    author: acceptance
      ? acceptance.publicName || "Автор"
      : entry.user.name?.trim() || "Автор",
    caption:
      acceptance && !acceptance.fields.includes("caption")
        ? ""
        : revision.caption,
    number:
      acceptance && !acceptance.fields.includes("number")
        ? undefined
        : (revision.number ?? undefined),
  };
}
export function mapContestWork(entry: ContestEntryRecord) {
  const revision = entry.revisions[0]!;
  const published = publishedValues(entry);
  return {
    id: entry.publicId,
    title: published.caption || revision.product.title,
    author: published.author,
    albumId: revision.productId,
    albumTitle: revision.product.title,
    number: published.number,
    image: contestPhotoUrl(entry.publicId),
    product: {
      slug: revision.product.slug,
      title: revision.product.title,
      categorySlug: revision.product.category?.slug,
    },
  };
}
export function mapContestGalleryWork(entry: ContestEntryRecord) {
  const revision = entry.revisions[0]!;
  const published = publishedValues(entry);
  return {
    source: "contest" as const,
    publicId: entry.publicId,
    title: published.caption || revision.product.title,
    author: { name: published.author },
    album: {
      slug: revision.product.coloringCollection?.slug ?? revision.product.slug,
      title: revision.product.title,
    },
    number: published.number,
    relatedProduct: {
      slug: revision.product.slug,
      title: revision.product.title,
      categorySlug: revision.product.category?.slug,
    },
    contest: { slug: entry.contest.slug, title: entry.contest.title },
    submission: {
      caption: published.caption || undefined,
      publishedAt: entry.publishedAt!.toISOString(),
      assets: {
        web: contestPhotoUrl(entry.publicId),
        thumb: contestPhotoUrl(entry.publicId, "thumb"),
      },
    },
  };
}
