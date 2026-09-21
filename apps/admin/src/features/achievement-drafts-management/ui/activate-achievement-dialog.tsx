"use client";

import { CircleCheck } from "lucide-react";
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

import { useActivateAchievementDraft } from "../model";

export function ActivateAchievementDialog({
  achievement,
}: {
  readonly achievement: AchievementDraft;
}) {
  const [open, setOpen] = useState(false);
  const [expectedVersion, setExpectedVersion] = useState(achievement.version);
  const activateAchievement = useActivateAchievementDraft({
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (activateAchievement.isPending) return;
        if (nextOpen) setExpectedVersion(achievement.version);
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" type="button">
          <CircleCheck data-icon="inline-start" aria-hidden="true" />
          Активировать
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!activateAchievement.isPending}>
        <DialogHeader>
          <DialogTitle>Активировать ачивку?</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              {achievement.conditionKind === "completed_order_count"
                ? "Система автоматически проверит прошлые оплаченные и завершённые заказы участника и будет учитывать новые."
                : "Система автоматически проверит уже одобренные публичные раскраски и будет учитывать новые."}
            </span>
            <span className="block">
              {achievement.conditionKind === "distinct_collection_count" ? (
                <>
                  Цель по числу тематик: {achievement.target}. Достаточно одной
                  работы из каждой тематики. Каждая картина по-прежнему
                  учитывается отдельно для других наград.
                </>
              ) : achievement.conditionKind === "completed_collection_count" ? (
                <>
                  Цель по числу завершённых альбомов: {achievement.target}.
                  Нужны одобренные публичные работы на все картины
                  зафиксированного состава. Неполные альбомы не засчитываются.
                  Полученная ачивка и награда сохраняются, даже если работы
                  позже скрыты.
                </>
              ) : achievement.conditionKind === "completed_order_count" ? (
                <>
                  Цель по числу заказов: {achievement.target}. Полностью
                  возвращённые заказы не учитываются до получения ачивки.
                  Частичный возврат не исключает заказ, если остался хотя бы
                  один товар. Промокоды и списание баллов не мешают получить
                  награду. Уже полученная ачивка и награда сохраняются.
                </>
              ) : (
                <>Цель по числу картин: {achievement.target}.</>
              )}
            </span>
            <span className="block">
              За достижение участнику будет начислено {achievement.rewardPoints}{" "}
              баллов. Эта ачивка выдаётся каждому участнику только один раз.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              disabled={activateAchievement.isPending}
              type="button"
              variant="outline"
            >
              Отмена
            </Button>
          </DialogClose>
          <Button
            disabled={activateAchievement.isPending}
            onClick={() =>
              activateAchievement.mutate({
                achievementId: achievement.id,
                expectedVersion,
              })
            }
            type="button"
          >
            Активировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
