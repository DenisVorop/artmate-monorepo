import type { Prisma } from "../../generated/prisma/client";

// Published product fields are the catalog's read contract; orders never edit products.
export const prizeProductInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  category: true,
} satisfies Prisma.ProductInclude;
export type PrizeProduct = Prisma.ProductGetPayload<{
  include: typeof prizeProductInclude;
}>;
export function isPrizeAlbum(product: PrizeProduct) {
  return product.status === "PUBLISHED" && product.category?.slug !== "markery";
}
export function isPrizeAlbumAvailable(product: PrizeProduct) {
  return (
    isPrizeAlbum(product) &&
    Boolean(product.images[0]?.url.trim()) &&
    !product.isOutOfStock &&
    product.isOzonDeliveryAvailable
  );
}
export function mapPrizeAlbum(product: PrizeProduct) {
  return {
    id: product.id,
    title: product.title.replace(/,?\s*\d+\s+картин(?:а|ы)?$/iu, ""),
    image: product.images[0]?.url ?? "",
    available: isPrizeAlbumAvailable(product),
  };
}
