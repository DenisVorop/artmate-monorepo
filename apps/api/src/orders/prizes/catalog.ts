import type { Prisma } from "../../generated/prisma/client";

// Published product fields are the catalog's read contract; orders never edit products.
export const prizeProductInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  category: true,
} satisfies Prisma.ProductInclude;
export type PrizeProduct = Prisma.ProductGetPayload<{
  include: typeof prizeProductInclude;
}>;
export function isPrizeProductAvailable(
  product: PrizeProduct,
  kind: "albums" | "markers",
) {
  return (
    product.status === "PUBLISHED" &&
    (kind === "markers"
      ? product.category?.slug === "markery"
      : product.category?.slug !== "markery") &&
    Boolean(product.images[0]?.url.trim()) &&
    !product.isOutOfStock &&
    product.isOzonDeliveryAvailable
  );
}
export function mapPrizeProduct(
  product: PrizeProduct,
  kind: "albums" | "markers",
) {
  return {
    id: product.id,
    title:
      kind === "albums"
        ? product.title.replace(/,?\s*\d+\s+картин(?:а|ы)?$/iu, "")
        : product.title,
    image: product.images[0]?.url ?? "",
    available: isPrizeProductAvailable(product, kind),
  };
}
