import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ProductPage } from "@/pages/product";
import { getAdminSession } from "@/shared/actions/auth";
import { getAdminProduct, getProductCategories } from "@/shared/actions/products";
import { routes } from "@/shared/constants";

export const metadata: Metadata = {
  title: "Товар - Artmate Admin",
};

type ProductRouteProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function Page({ params }: ProductRouteProps) {
  const { productId } = await params;
  const session = await getAdminSession();

  if (!session.user) {
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.product(productId))}`,
    );
  }

  const [product, categories] = await Promise.all([
    getAdminProductOrNotFound(productId),
    getProductCategories(),
  ]);

  return (
    <ProductPage
      categories={categories}
      currentUser={session.user}
      product={product}
    />
  );
}

async function getAdminProductOrNotFound(productId: string) {
  try {
    return await getAdminProduct(productId);
  } catch (error) {
    if (isProductNotFoundError(error)) {
      notFound();
    }

    throw error;
  }
}

function isProductNotFoundError(error: unknown) {
  return error instanceof Error && error.message === "Product not found";
}
