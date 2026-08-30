import Link from "next/link";
import { Plus } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { DigitalVersionsManagement } from "@/features/coloring-collections-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

export function DigitalVersionsPage({ currentUser }: { readonly currentUser: AuthUser }) {
  return (
    <AdminShell activePath={routes.digitalVersions}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">Контент раскрасок</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Цифровые версии
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Тематические коллекции и готовность изображений.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href={routes.digitalVersionCreate}>
                <Plus data-icon="inline-start" aria-hidden="true" />
                Новая коллекция
              </Link>
            </Button>
            <SessionMenu user={currentUser} />
          </div>
        </header>
        <DigitalVersionsManagement />
      </section>
    </AdminShell>
  );
}
