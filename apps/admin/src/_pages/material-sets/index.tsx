import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { MaterialSetsManagement } from "@/features/material-sets-management";
import { routes } from "@/shared/constants";
import { AdminShell } from "@/widgets/admin-shell";

export function MaterialSetsPage({
  currentUser,
}: {
  readonly currentUser: AuthUser;
}) {
  return (
    <AdminShell activePath={routes.materialSets}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Наборы материалов
          </h1>
          <SessionMenu user={currentUser} />
        </header>
        <MaterialSetsManagement />
      </section>
    </AdminShell>
  );
}
