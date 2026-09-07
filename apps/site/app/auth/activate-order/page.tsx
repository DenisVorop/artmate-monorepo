import { OrderActivation } from "@/features/order-activation";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

type OrderActivationRouteProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.authOrderActivation,
    fallback: createPageMetadata("auth"),
  });
}

export default async function Page({ searchParams }: OrderActivationRouteProps) {
  const { token } = await searchParams;

  return <OrderActivation token={Array.isArray(token) ? token[0] : token} />;
}
