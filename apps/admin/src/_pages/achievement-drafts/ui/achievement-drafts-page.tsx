import { Trophy } from "lucide-react";

import { AchievementDraftsManagement } from "@/features/achievement-drafts-management";
import { routes } from "@/shared/constants";
import { Badge, Card, CardContent } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

export function AchievementDraftsPage() {
  return (
    <AdminShell activePath={routes.achievementDrafts}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6">
          <Badge variant="outline">
            <Trophy data-icon="inline-start" aria-hidden="true" />
            Лояльность
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
            Ачивки
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Настройка условий и наград в версионном реестре.
          </p>
        </header>

        <Card className="mb-4 bg-muted/40" size="sm">
          <CardContent className="flex items-start gap-2 font-medium">
            <Trophy className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Автовыдачу можно включить за опубликованные картины, разнообразие
              тематик, завершённые альбомы и покупки. Условия и награды задаёте
              вы; достижения участников проверяются автоматически.
            </span>
          </CardContent>
        </Card>

        <AchievementDraftsManagement />
      </section>
    </AdminShell>
  );
}
