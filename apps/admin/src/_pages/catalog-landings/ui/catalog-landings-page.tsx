import Link from "next/link";
import { Plus } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { CatalogLandingsManagement } from "@/features/catalog-landings-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type CatalogLandingsPageProps = {
  readonly currentUser: AuthUser;
};

export function CatalogLandingsPage({ currentUser }: CatalogLandingsPageProps) {
  return (
    <AdminShell activePath={routes.catalogLandings}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">SEO каталог</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Подборки каталога
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href={routes.catalogLandingCreate}>
                <Plus data-icon="inline-start" aria-hidden="true" />
                Новая подборка
              </Link>
            </Button>
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <CatalogLandingsManagement />
      </section>
    </AdminShell>
  );
}
