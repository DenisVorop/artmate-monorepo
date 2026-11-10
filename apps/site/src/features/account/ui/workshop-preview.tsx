"use client";

import { useAnalytics } from "../lib/analytics";
import { ArrowUpRight } from "lucide-react";
import { useSession } from "@/entities/session";
import { WorkshopCollectionCard, useWorkshopPreview } from "@/entities/workshop";
import { routes } from "@/shared/constants";
import { Button, DataState } from "@/shared/ui";
import { Skeleton } from "@/shared/ui/skeleton";
import { HorizontalRail } from "@/shared/ui/horizontal-rail";
import { Link } from "@/shared/ui/link";
import { SectionTitle } from "@/shared/ui/typography";

export function AccountWorkshopPreview() {
  const { user } = useSession();
  if (!user) return null;
  return <WorkshopPreview key={user.id} userId={user.id} />;
}

function WorkshopPreview({ userId }: { userId: string }) {
  const analytics = useAnalytics();
  const { data, isPending, isError } = useWorkshopPreview(userId);
  return (
    <section className="min-w-0 space-y-5" aria-labelledby="account-workshop">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle id="account-workshop">Моя мастерская</SectionTitle>
        <Button asChild variant="ghost" className="min-h-11">
          <Link href={routes.workshop} onClick={analytics.workshopOpened}>
            Вся мастерская
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
      {isPending ? (
        <HorizontalRail label="Загружаем мастерскую" className="auto-cols-[min(76vw,18rem)]">
          <Skeleton className="aspect-[3/4] rounded-2xl" />
          <Skeleton className="aspect-[3/4] rounded-2xl" />
        </HorizontalRail>
      ) : isError ? (
        <DataState
          variant="error"
          title="Не удалось загрузить мастерскую"
          description="Ваши работы сохранены. Попробуйте обновить страницу позже."
          className="max-w-none"
        />
      ) : data?.collections.length ? (
        <HorizontalRail label="Лента мастерской" className="auto-cols-[min(76vw,18rem)]">
          {data.collections.map((collection) => (
            <WorkshopCollectionCard key={collection.id} collection={collection} />
          ))}
        </HorizontalRail>
      ) : (
        <div className="space-y-4 rounded-2xl border border-orange-100 bg-orange-50/40 p-6">
          <p className="font-semibold">У каждой картины — ваша история</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Выберите раскраску и добавьте свою первую работу. Здесь появятся ваши коллекции.
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={routes.colorings} onClick={analytics.coloringCatalogOpened}>
              Выбрать раскраску
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
