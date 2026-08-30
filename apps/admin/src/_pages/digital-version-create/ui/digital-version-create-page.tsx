import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { CreateDigitalVersion } from "@/features/coloring-collections-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

export function DigitalVersionCreatePage({ currentUser }: { readonly currentUser: AuthUser }) {
  return (
    <AdminShell activePath={routes.digitalVersions}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={routes.digitalVersions}>
                  <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                  Цифровые версии
                </Link>
              </Button>
              <Badge variant="outline">Новая коллекция</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              Создание цифровой версии
            </h1>
          </div>
          <SessionMenu user={currentUser} />
        </header>
        <CreateDigitalVersion />
      </section>
    </AdminShell>
  );
}
