import { AuthRoute } from "@/features/auth";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.authOrderActivation,
    fallback: createPageMetadata("auth"),
  });
}

type ActivationRouteProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function Page({ searchParams }: ActivationRouteProps) {
  const { token } = await searchParams;
  return (
    <AuthRoute
      entry="activation"
      token={Array.isArray(token) ? token[0] : token}
      next={routes.account}
    />
  );
}
