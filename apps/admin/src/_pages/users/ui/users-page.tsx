import type { AuthUser } from "@/entities/session";
import type { AdminUser } from "@/entities/users";
import { SessionMenu } from "@/features/auth";
import { UsersManagement } from "@/features/users-management";
import { routes } from "@/shared/constants";
import { AdminShell } from "@/widgets/admin-shell";
import { Badge } from "@/shared/ui";

type UsersPageProps = {
  readonly currentUser: AuthUser;
  readonly users: readonly AdminUser[];
};

export function UsersPage({ currentUser, users }: UsersPageProps) {
  return (
    <AdminShell activePath={routes.users}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">Аккаунты</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Управление пользователями
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <UsersManagement currentUserId={currentUser.id} users={users} />
      </section>
    </AdminShell>
  );
}
