import { AuthPage } from "@/pages/auth";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.auth,
    fallback: createPageMetadata("auth"),
  });
}

type AuthRouteProps = {
  searchParams: Promise<{
    next?: string | string[];
    resume?: string | string[];
  }>;
};

export default async function Page({ searchParams }: AuthRouteProps) {
  const { next, resume } = await searchParams;
  return (
    <AuthPage
      next={Array.isArray(next) ? next[0] : next}
      resume={resume === "1"}
    />
  );
}
