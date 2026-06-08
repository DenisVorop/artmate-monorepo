import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { ProductTagsManagement } from "@/features/products-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type ProductTagsPageProps = {
  readonly currentUser: AuthUser;
};

export function ProductTagsPage({ currentUser }: ProductTagsPageProps) {
  return (
    <AdminShell activePath={routes.products}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">Каталог</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Теги товаров
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="outline">
              <Link href={routes.products}>
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                Товары
              </Link>
            </Button>
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <ProductTagsManagement />
      </section>
    </AdminShell>
  );
}
