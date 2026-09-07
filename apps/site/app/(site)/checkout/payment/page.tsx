import { redirect } from "next/navigation";

import { CheckoutFailurePage } from "@/pages/checkout-failure";
import { getAuthSession } from "@/shared/actions/auth";
import { getOrder } from "@/shared/actions/orders";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.checkoutPayment,
    fallback: createPageMetadata("checkoutPayment"),
  });
}

type CheckoutPaymentRouteProps = {
  searchParams: Promise<{
    orderId?: string | string[];
  }>;
};

export default async function Page({ searchParams }: CheckoutPaymentRouteProps) {
  const [{ orderId }, sessionResult] = await Promise.all([
    searchParams,
    getAuthSession(),
  ]);
  const normalizedOrderId = Array.isArray(orderId) ? orderId[0] : orderId;
  const session = ApiResult.fromDTO(sessionResult).data;

  if (!normalizedOrderId) {
    redirect(routes.checkout);
  }

  let order;
  if (session?.user && normalizedOrderId) {
    const orderResult = ApiResult.fromDTO(await getOrder(normalizedOrderId));
    order = orderResult.isError ? undefined : orderResult.data;
  }

  if (!order) {
    return <CheckoutFailurePage hasOwnerOrder={false} orderId={normalizedOrderId} />;
  }

  if (order.payment.status === "paid") {
    redirect(createOrderRoute(routes.checkoutSuccess, order.id));
  }

  if (order.payment.status === "failed") {
    redirect(createOrderRoute(routes.checkoutFailure, order.id));
  }

  if (order.status !== "waiting_payment") {
    redirect(createOrderRoute(routes.checkoutFailure, order.id));
  }

  if (order.payment.redirectUrl) {
    redirect(order.payment.redirectUrl);
  }

  redirect(createOrderRoute(routes.checkoutSuccess, order.id));
}

function createOrderRoute(path: string, orderId: string) {
  return `${path}?orderId=${encodeURIComponent(orderId)}`;
}
