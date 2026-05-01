import { redirect } from "next/navigation";

import { ProductsPage } from "@/pages/products";
import { getAdminSession } from "@/shared/actions/auth";
import { getAdminProducts } from "@/shared/actions/products";
import { routes } from "@/shared/constants";

export { metadata } from "@/pages/products/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.products)}`);
  }

  const products = await getAdminProducts();

  return (
    <ProductsPage
      currentUser={session.user}
      products={products}
    />
  );
}
