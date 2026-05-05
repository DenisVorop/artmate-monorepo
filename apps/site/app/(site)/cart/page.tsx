import { CartPage } from "@/pages/cart";
import { createPageMetadata } from "@/shared/lib/seo";

export const metadata = createPageMetadata("cart");

export default function Page() {
  return <CartPage />;
}
