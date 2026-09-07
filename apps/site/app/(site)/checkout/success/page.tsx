import { CheckoutSuccessPage } from "@/pages/checkout-success";
import { getAuthSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";
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
  const [{ orderId }, sessionResult] = await Promise.all([searchParams, getAuthSession()]);
  const normalizedOrderId = Array.isArray(orderId) ? orderId[0] : orderId;
  const session = ApiResult.fromDTO(sessionResult).data;

  return (
    <CheckoutSuccessPage isAuthenticated={Boolean(session?.user)} orderId={normalizedOrderId} />
  );
}
