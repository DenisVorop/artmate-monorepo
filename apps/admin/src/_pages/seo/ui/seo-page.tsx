import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { SeoManagement } from "@/features/seo-management";
import { routes } from "@/shared/constants";
import { Badge } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type SeoPageProps = {
  readonly currentUser: AuthUser;
};

export function SeoPage({ currentUser }: SeoPageProps) {
  return (
    <AdminShell activePath={routes.seo}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">SEO</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              SEO
            </h1>
          </div>

          <SessionMenu user={currentUser} />
        </header>

        <SeoManagement />
      </section>
    </AdminShell>
  );
}
