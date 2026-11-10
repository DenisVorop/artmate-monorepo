"use client";

import { useAnalytics } from "../lib/analytics";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  AchievementCard,
  getAchievementPreview,
  useAchievementsData,
} from "@/entities/achievement";
import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Button, DataState, Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { Skeleton } from "@/shared/ui/skeleton";
import { HorizontalRail } from "@/shared/ui/horizontal-rail";
import { SectionTitle } from "@/shared/ui/typography";
import {
  achievementFilters,
  filterAchievements,
  type AchievementFilter,
} from "../lib/achievement-state";

export function AchievementGallery({ preview = false }: { preview?: boolean }) {
  const { user } = useSession();
  if (!user) return null;
  return <UserGallery key={`${user.id}:${preview}`} userId={user.id} preview={preview} />;
}

function UserGallery({ userId, preview }: { userId: string; preview: boolean }) {
  const analytics = useAnalytics();
  const [filter, setFilter] = useState<AchievementFilter>("all");
  const achievements = useAchievementsData(userId);
  const items = achievements.data?.achievements ?? [];
  const filtered = filterAchievements(items, filter);
  return (
    <section className="min-w-0 space-y-5" aria-label="Достижения">
      {preview && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Достижения</SectionTitle>
          <Button asChild variant="ghost" className="min-h-11">
            <Link href={routes.accountAchievements} onClick={analytics.allOpened}>
              Все достижения
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
      {achievements.isPending ? (
        <Skeleton className="h-64 rounded-2xl" aria-label="Загружаем достижения" />
      ) : achievements.isError ? (
        <DataState
          variant="error"
          title="Не удалось загрузить достижения"
          description="Попробуйте обновить страницу позже."
        />
      ) : !items.length ? (
        <DataState
          title="Достижения скоро появятся"
          description="Здесь будут ваши значки и прогресс."
        />
      ) : preview ? (
        <HorizontalRail label="Лента достижений">
          {getAchievementPreview(items).map((item) => (
            <AchievementCard key={item.id} item={item} />
          ))}
        </HorizontalRail>
      ) : (
        <Tabs
          value={filter}
          onValueChange={(value) => {
            if (value === filter) return;
            analytics.filterChanged();
            setFilter(value as AchievementFilter);
          }}
          className="gap-6"
        >
          <TabsList
            className="w-full group-data-horizontal/tabs:h-11 sm:w-fit"
            aria-label="Фильтр достижений"
          >
            {achievementFilters.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="min-h-10 px-3">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={filter}>
            {filtered.length ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((item) => (
                  <AchievementCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <DataState
                title={filter === "earned" ? "Все открытия ещё впереди" : "Все достижения получены"}
                description={
                  filter === "earned"
                    ? "Переключитесь на «Впереди», чтобы выбрать следующую цель."
                    : "Заглядывайте за новыми поводами творить."
                }
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
