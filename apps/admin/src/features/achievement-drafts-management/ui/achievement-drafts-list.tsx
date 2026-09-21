"use client";

import { Trophy } from "lucide-react";

import {
  canActivateAchievement,
  getAchievementConditionLabel,
  getAchievementStatusLabel,
  hasUnpublishedAchievementChanges,
  sortAchievementDrafts,
  type AchievementDraft,
} from "@/entities/achievement-drafts";
import {
  Badge,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

import { ActivateAchievementDialog } from "./activate-achievement-dialog";
import { ArchiveAchievementDialog } from "./archive-achievement-dialog";
import { EditAchievementDialog } from "./edit-achievement-dialog";

export function AchievementDraftsList({
  achievements,
}: {
  readonly achievements: readonly AchievementDraft[];
}) {
  const ordered = sortAchievementDrafts(achievements);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Реестр ачивок</CardTitle>
        <CardDescription>
          Версионные настройки, активные правила и архивные записи.
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">
            <Trophy data-icon="inline-start" aria-hidden="true" />
            {achievements.length}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {ordered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">Ачивок пока нет</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Заполните форму, чтобы создать первый черновик.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ачивка</TableHead>
                <TableHead>Условие</TableHead>
                <TableHead>Награда</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((achievement) => (
                <AchievementDraftRow
                  achievement={achievement}
                  key={achievement.id}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AchievementDraftRow({
  achievement,
}: {
  readonly achievement: AchievementDraft;
}) {
  const archived = achievement.status === "archived";
  const canActivate = canActivateAchievement(achievement);
  const hasUnpublishedChanges = hasUnpublishedAchievementChanges(achievement);

  return (
    <TableRow>
      <TableCell className="min-w-64 whitespace-normal">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{achievement.title}</span>
            <Badge variant="outline">v{achievement.version}</Badge>
          </div>
          {achievement.description ? (
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {achievement.description}
            </span>
          ) : null}
          {achievement.imageUrl ? (
            // Uploaded raster is served directly from the API uploads volume.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="size-12 rounded-md border bg-muted/30 object-contain"
              height={48}
              src={achievement.imageUrl}
              width={48}
            />
          ) : null}
        </div>
      </TableCell>
      <TableCell className="min-w-48 whitespace-normal">
        <div className="grid gap-1">
          <span>{getAchievementConditionLabel(achievement.conditionKind)}</span>
          <span className="text-xs text-muted-foreground">
            Цель: {achievement.target}
          </span>
        </div>
      </TableCell>
      <TableCell>{achievement.rewardPoints} баллов</TableCell>
      <TableCell>
        <div className="grid gap-1">
          <Badge
            variant={
              archived
                ? "outline"
                : achievement.status === "active"
                  ? "default"
                  : "secondary"
            }
          >
            {getAchievementStatusLabel(achievement.status)}
          </Badge>
          {achievement.activeVersion === null ? null : (
            <span className="text-xs text-muted-foreground">
              {archived ? "Последняя активная" : "Активна"} v
              {achievement.activeVersion}
            </span>
          )}
          {hasUnpublishedChanges ? (
            <Badge variant="secondary">Есть изменения</Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Порядок: {achievement.sortOrder}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <EditAchievementDialog achievement={achievement} />
          {canActivate ? (
            <ActivateAchievementDialog achievement={achievement} />
          ) : null}
          {archived ? null : (
            <ArchiveAchievementDialog achievement={achievement} />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
