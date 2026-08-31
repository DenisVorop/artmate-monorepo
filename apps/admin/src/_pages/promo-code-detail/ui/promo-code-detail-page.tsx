import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { PromoCodeDetails } from "@/features/promocodes-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type PromoCodeDetailPageProps = {
  readonly currentUser: AuthUser;
  readonly promoCodeId: string;
};

export function PromoCodeDetailPage({
  currentUser,
  promoCodeId,
}: PromoCodeDetailPageProps) {
  return (
    <AdminShell activePath={routes.promoCodes}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
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
              Промокод
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{promoCodeId}</p>
          </div>
          <SessionMenu user={currentUser} />
        </header>
        <PromoCodeDetails promoCodeId={promoCodeId} />
      </section>
    </AdminShell>
  );
}
