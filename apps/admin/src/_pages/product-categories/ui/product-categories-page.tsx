import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { ProductCategoriesManagement } from "@/features/products-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type ProductCategoriesPageProps = {
  readonly currentUser: AuthUser;
};

export function ProductCategoriesPage({
  currentUser,
}: ProductCategoriesPageProps) {
  return (
    <AdminShell activePath={routes.products}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={routes.products}>
                  <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                  Товары
                </Link>
              </Button>
              <Badge variant="outline">Справочник</Badge>
            </div>
            <h1 className="truncate text-3xl font-semibold tracking-normal sm:text-4xl">
              Категории товаров
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <ProductCategoriesManagement />
      </section>
    </AdminShell>
  );
}
