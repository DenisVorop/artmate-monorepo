import { CheckoutPage } from "@/pages/checkout";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.checkout,
    fallback: createPageMetadata("checkout"),
  });
}

export default function Page() {
  return <CheckoutPage />;
}
