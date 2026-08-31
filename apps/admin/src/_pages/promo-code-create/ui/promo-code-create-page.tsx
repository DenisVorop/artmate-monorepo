import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { CreatePromoCode } from "@/features/promocodes-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

export function PromoCodeCreatePage({
  currentUser,
}: {
  readonly currentUser: AuthUser;
}) {
  return (
    <AdminShell activePath={routes.promoCodes}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={routes.promoCodes}>
                  <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                  Промокоды
                </Link>
              </Button>
              <Badge variant="outline">Продажи</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              Новый промокод
            </h1>
          </div>
          <SessionMenu user={currentUser} />
        </header>
        <CreatePromoCode />
      </section>
    </AdminShell>
  );
}
