import { CheckoutSuccessPage } from "@/pages/checkout-success";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.checkoutSuccess,
    fallback: createPageMetadata("checkoutSuccess"),
  });
}

type CheckoutSuccessRouteProps = {
  searchParams: Promise<{
    orderId?: string | string[];
  }>;
};

export default async function Page({ searchParams }: CheckoutSuccessRouteProps) {
  const { orderId } = await searchParams;
  const normalizedOrderId = Array.isArray(orderId) ? orderId[0] : orderId;

  return <CheckoutSuccessPage orderId={normalizedOrderId} />;
}
