import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { PartnerApplicationsManagement } from "@/features/partner-applications-management";
import { routes } from "@/shared/constants";
import { Badge } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type PartnerApplicationsPageProps = {
  readonly currentUser: AuthUser;
};

export function PartnerApplicationsPage({
  currentUser,
}: PartnerApplicationsPageProps) {
  return (
    <AdminShell activePath={routes.partnerApplications}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">Лиды</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Партнёрские заявки
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Контакты креаторов, художников и других будущих партнёров Artmate.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <PartnerApplicationsManagement />
      </section>
    </AdminShell>
  );
}
