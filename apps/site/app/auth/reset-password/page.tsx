import { PasswordResetPage } from "@/pages/password-reset";
import { routes } from "@/shared/constants";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

type PasswordResetRouteProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.authResetPassword,
    fallback: createPageMetadata("auth"),
  });
}

export default async function Page({ searchParams }: PasswordResetRouteProps) {
  const { token } = await searchParams;

  return <PasswordResetPage token={Array.isArray(token) ? token[0] : token} />;
}
