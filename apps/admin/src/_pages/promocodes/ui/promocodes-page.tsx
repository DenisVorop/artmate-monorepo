import { Plus } from "lucide-react";
import Link from "next/link";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { PromoCodesManagement } from "@/features/promocodes-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

export function PromoCodesPage({
  currentUser,
}: {
  readonly currentUser: AuthUser;
}) {
  return (
    <AdminShell activePath={routes.promoCodes}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">Продажи</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Промокоды
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href={routes.promoCodeCreate}>
                <Plus data-icon="inline-start" aria-hidden="true" />
                Новый промокод
              </Link>
            </Button>
            <SessionMenu user={currentUser} />
          </div>
        </header>
        <PromoCodesManagement />
      </section>
    </AdminShell>
  );
}
