import { PaymentAndDeliveryPage } from "@/pages/payment-and-delivery";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.paymentAndDelivery,
    fallback: createPageMetadata("paymentAndDelivery"),
  });
}

export default PaymentAndDeliveryPage;
