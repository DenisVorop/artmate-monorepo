import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { PartnersManagement } from "@/features/partners-management";
import { routes } from "@/shared/constants";
import { Badge } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

export function PartnersPage({
  currentUser,
}: {
  readonly currentUser: AuthUser;
}) {
  return (
    <AdminShell activePath={routes.partners}>
      <section className="min-w-0 overflow-x-clip p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <Badge variant="outline">Партнёрская программа</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Партнёры
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Профили действующих партнёров, договоры и условия доступа в
              кабинет.
            </p>
          </div>
          <SessionMenu user={currentUser} />
        </header>
        <PartnersManagement />
      </section>
    </AdminShell>
  );
}
