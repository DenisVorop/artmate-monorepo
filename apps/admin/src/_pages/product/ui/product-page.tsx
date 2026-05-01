import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import type { Product, ProductCategory } from "@/entities/products";
import { SessionMenu } from "@/features/auth";
import { ProductDetailsManagement } from "@/features/products-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type ProductPageProps = {
  readonly categories: readonly ProductCategory[];
  readonly currentUser: AuthUser;
  readonly product: Product;
};

export function ProductPage({
  categories,
  currentUser,
  product,
}: ProductPageProps) {
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
              <Badge variant="outline">Карточка товара</Badge>
            </div>
            <h1 className="truncate text-3xl font-semibold tracking-normal sm:text-4xl">
              {product.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{product.slug}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <ProductDetailsManagement categories={categories} product={product} />
      </section>
    </AdminShell>
  );
}
