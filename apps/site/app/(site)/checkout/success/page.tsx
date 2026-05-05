import { CheckoutSuccessPage } from "@/pages/checkout-success";
import { createPageMetadata } from "@/shared/lib/seo";

export const metadata = createPageMetadata("checkoutSuccess");

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
