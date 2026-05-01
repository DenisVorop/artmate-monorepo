import { redirect } from "next/navigation";

import { ProductsPage } from "@/pages/products";
import { getAdminSession } from "@/shared/actions/auth";
import { getAdminProducts, getProductCategories } from "@/shared/actions/products";
import { routes } from "@/shared/constants";

export { metadata } from "@/pages/products/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.products)}`);
  }

  const [products, categories] = await Promise.all([
    getAdminProducts(),
    getProductCategories(),
  ]);

  return (
    <ProductsPage
      categories={categories}
      currentUser={session.user}
      products={products}
    />
  );
}
