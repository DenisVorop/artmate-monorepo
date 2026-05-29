import { CheckoutFailurePage } from "@/pages/checkout-failure";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.checkoutFailure,
    fallback: createPageMetadata("checkoutFailure"),
  });
}

type CheckoutFailureRouteProps = {
  searchParams: Promise<{
    orderId?: string | string[];
  }>;
};

export default async function Page({ searchParams }: CheckoutFailureRouteProps) {
  const { orderId } = await searchParams;
  const normalizedOrderId = Array.isArray(orderId) ? orderId[0] : orderId;

  return <CheckoutFailurePage orderId={normalizedOrderId} />;
}
