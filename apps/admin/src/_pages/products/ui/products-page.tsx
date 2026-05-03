import Link from "next/link";
import { FolderTree } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { ProductsManagement } from "@/features/products-management";
import { routes } from "@/shared/constants";
import { AdminShell } from "@/widgets/admin-shell";
import { Badge, Button } from "@/shared/ui";

type ProductsPageProps = {
  readonly currentUser: AuthUser;
};

export function ProductsPage({ currentUser }: ProductsPageProps) {
  return (
    <AdminShell activePath={routes.products}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">Каталог</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Товары
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="outline">
              <Link href={routes.productCategories}>
                <FolderTree data-icon="inline-start" aria-hidden="true" />
                Категории
              </Link>
            </Button>
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <ProductsManagement />
      </section>
    </AdminShell>
  );
}
