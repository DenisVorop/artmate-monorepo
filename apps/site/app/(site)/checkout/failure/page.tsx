import { CheckoutFailurePage } from "@/pages/checkout-failure";
import { getAuthSession } from "@/shared/actions/auth";
import { getOrder } from "@/shared/actions/orders";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";
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
  const [{ orderId }, sessionResult] = await Promise.all([searchParams, getAuthSession()]);
  const normalizedOrderId = Array.isArray(orderId) ? orderId[0] : orderId;
  const session = ApiResult.fromDTO(sessionResult).data;
  let hasOwnerOrder = false;
  if (session?.user && normalizedOrderId) {
    const orderResult = ApiResult.fromDTO(await getOrder(normalizedOrderId));
    hasOwnerOrder = orderResult.isSuccess && Boolean(orderResult.data);
  }

  return (
    <CheckoutFailurePage hasOwnerOrder={hasOwnerOrder} orderId={normalizedOrderId} />
  );
}
