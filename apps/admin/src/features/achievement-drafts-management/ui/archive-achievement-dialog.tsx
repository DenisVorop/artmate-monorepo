"use client";

import { Archive } from "lucide-react";
import { useState } from "react";

import type { AchievementDraft } from "@/entities/achievement-drafts";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui";

import { useArchiveAchievementDraft } from "../model";

export function ArchiveAchievementDialog({
  achievement,
}: {
  readonly achievement: AchievementDraft;
}) {
  const [open, setOpen] = useState(false);
  const [expectedVersion, setExpectedVersion] = useState(achievement.version);
  const archiveAchievement = useArchiveAchievementDraft({
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (archiveAchievement.isPending) return;
        if (nextOpen) setExpectedVersion(achievement.version);
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="destructive">
          <Archive data-icon="inline-start" aria-hidden="true" />В архив
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!archiveAchievement.isPending}>
        <DialogHeader>
          <DialogTitle>Архивировать ачивку?</DialogTitle>
          <DialogDescription>
            «{achievement.title}» останется в реестре. Новые награды по этой
            ачивке выдаваться не будут, а уже полученные сохранятся.
            Редактирование станет недоступно.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              disabled={archiveAchievement.isPending}
              type="button"
              variant="outline"
            >
              Отмена
            </Button>
          </DialogClose>
          <Button
            disabled={archiveAchievement.isPending}
            type="button"
            variant="destructive"
            onClick={() =>
              archiveAchievement.mutate({
                achievementId: achievement.id,
                expectedVersion,
              })
            }
          >
            Архивировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
