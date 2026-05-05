import { CartPage } from "@/pages/cart";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.cart,
    fallback: createPageMetadata("cart"),
  });
}

export default function Page() {
  return <CartPage />;
}
