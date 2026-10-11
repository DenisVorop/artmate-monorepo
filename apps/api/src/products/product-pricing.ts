import type { Prisma } from "../generated/prisma/client";

type ProductPrice = { price: number; salePrice?: number | null };

export function getProductPrice(product: ProductPrice) {
  return product.salePrice ?? product.price;
}

/** Published prices are the read contract for cart and checkout calculations. */
export async function readProductPrices(
  client: Pick<Prisma.TransactionClient, "product">,
  productIds: readonly string[],
) {
  const products =
    productIds.length === 0
      ? []
      : await client.product.findMany({
          where: { id: { in: [...new Set(productIds)] }, status: "PUBLISHED" },
          select: { id: true, price: true, salePrice: true },
        });

  return new Map(products.map((product) => [product.id, product]));
}
