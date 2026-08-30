import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { ColoringDetails } from "@/features/colorings-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type Props = {
  readonly collectionId: string;
  readonly coloringId: string;
  readonly currentUser: AuthUser;
};

export function ColoringDetailPage({ collectionId, coloringId, currentUser }: Props) {
  return (
    <AdminShell activePath={routes.digitalVersions}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={routes.digitalVersion(collectionId)}>
                  <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                  К коллекции
                </Link>
              </Button>
              <Badge variant="outline">Раскраска</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              Подготовка изображения
            </h1>
          </div>
          <SessionMenu user={currentUser} />
        </header>
        <ColoringDetails collectionId={collectionId} coloringId={coloringId} />
      </section>
    </AdminShell>
  );
}
