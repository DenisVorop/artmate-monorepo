import { redirect } from "next/navigation";

import { getSafeAuthRedirectPath } from "@/features/auth";
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
  const { orderId } = await searchParams;
  const normalizedOrderId = Array.isArray(orderId) ? orderId[0] : orderId;

  if (!normalizedOrderId) {
    redirect(routes.checkout);
  }

  const redirectPath = createOrderRoute(routes.checkoutPayment, normalizedOrderId);
  const orderResult = ApiResult.fromDTO(await getOrder(normalizedOrderId));
  const order = orderResult.isError ? undefined : orderResult.data;

  if (!order) {
    redirect(`${routes.auth}?next=${encodeURIComponent(getSafeAuthRedirectPath(redirectPath))}`);
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
