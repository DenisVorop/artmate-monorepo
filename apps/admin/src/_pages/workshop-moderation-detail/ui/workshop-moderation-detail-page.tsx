import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { WorkshopModerationDetail } from "@/features/workshop-moderation";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

export function WorkshopModerationDetailPage({
  currentUser,
  revisionId,
}: {
  readonly currentUser: AuthUser;
  readonly revisionId: string;
}) {
  return (
    <AdminShell activePath={routes.workshopModeration}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild className="min-h-11" variant="outline">
                <Link href={routes.workshopModeration}>
                  <ArrowLeft data-icon="inline-start" aria-hidden="true" />К
                  очереди
                </Link>
              </Button>
              <Badge variant="outline">Неизменяемая ревизия</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Проверка работы
            </h1>
          </div>
          <SessionMenu user={currentUser} />
        </header>
        <WorkshopModerationDetail revisionId={revisionId} />
      </section>
    </AdminShell>
  );
}
