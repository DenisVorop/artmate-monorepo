import { ArrowLeft } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { OrderHistory } from "@/features/order-history";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type OrderHistoryPageProps = {
  readonly currentUser: AuthUser;
  readonly orderId: string;
};

export function OrderHistoryPage({
  currentUser,
  orderId,
}: OrderHistoryPageProps) {
  return (
    <AdminShell activePath={routes.orders}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">История</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Заказ {orderId}
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="outline">
              <a href={routes.orders}>
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                К CRM
              </a>
            </Button>
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <OrderHistory orderId={orderId} />
      </section>
    </AdminShell>
  );
}
