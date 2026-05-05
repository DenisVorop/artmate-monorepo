import { CheckoutPage } from "@/pages/checkout";
import { createPageMetadata } from "@/shared/lib/seo";

export const metadata = createPageMetadata("checkout");

export default function Page() {
  return <CheckoutPage />;
}
