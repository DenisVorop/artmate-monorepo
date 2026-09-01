import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { WorkshopModerationQueue } from "@/features/workshop-moderation";
import { routes } from "@/shared/constants";
import { Badge } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

export function WorkshopModerationPage({
  currentUser,
}: {
  readonly currentUser: AuthUser;
}) {
  return (
    <AdminShell activePath={routes.workshopModeration}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Badge variant="outline">Моя мастерская</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Модерация работ
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Проверка пользовательских фото, материалов и соответствия
              официальной цифровой версии.
            </p>
          </div>
          <SessionMenu user={currentUser} />
        </header>
        <WorkshopModerationQueue />
      </section>
    </AdminShell>
  );
}
