import { CheckoutSuccessPage } from "@/pages/checkout-success";
import { metadata } from "@/pages/checkout-success/metadata";

export { metadata };

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
