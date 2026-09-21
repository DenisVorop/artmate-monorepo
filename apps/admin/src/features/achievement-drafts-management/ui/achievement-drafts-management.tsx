"use client";

import { RefreshCw } from "lucide-react";

import { useAchievementDrafts } from "@/entities/achievement-drafts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import { AchievementDraftsList } from "./achievement-drafts-list";
import { CreateAchievementCard } from "./create-achievement-card";

export function AchievementDraftsManagement() {
  const { achievements, isError, isPending, refetch } = useAchievementDrafts();

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка ачивок</CardTitle>
          <CardDescription>Получаем версионный реестр.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить ачивки</CardTitle>
          <CardDescription>
            Проверьте соединение и повторите загрузку.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]">
      <CreateAchievementCard />
      <AchievementDraftsList achievements={achievements} />
    </div>
  );
}
