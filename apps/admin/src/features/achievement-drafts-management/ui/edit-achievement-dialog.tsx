"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

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

import {
  achievementDraftFormSchema,
  getAchievementDraftFormValues,
  toUpdateAchievementDraftInput,
  type AchievementDraftFormValues,
} from "../lib";
import { useUpdateAchievementDraft } from "../model";
import { AchievementFormFields } from "./achievement-form-fields";

export function EditAchievementDialog({
  achievement,
}: {
  readonly achievement: AchievementDraft;
}) {
  const [open, setOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState(achievement.version);
  const [imageSelected, setImageSelected] = useState(false);
  const [imageUploadPending, setImageUploadPending] = useState(false);
  const archived = achievement.status === "archived";
  const form = useForm<AchievementDraftFormValues>({
    defaultValues: getAchievementDraftFormValues(achievement),
    resolver: zodResolver(achievementDraftFormSchema),
  });
  const updateAchievement = useUpdateAchievementDraft({
    onSuccess: () => setOpen(false),
  });
  const submitForm = form.handleSubmit((values) => {
    if (
      archived ||
      updateAchievement.isPending ||
      imageUploadPending ||
      imageSelected
    )
      return;
    updateAchievement.mutate({
      achievementId: achievement.id,
      input: toUpdateAchievementDraftInput(values, editingVersion),
    });
  });

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && (imageUploadPending || updateAchievement.isPending))
      return;

    setOpen(nextOpen);
    setImageSelected(false);
    setImageUploadPending(false);

    if (nextOpen) {
      setEditingVersion(achievement.version);
      form.reset(getAchievementDraftFormValues(achievement));
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          {archived ? (
            <Eye data-icon="inline-start" aria-hidden="true" />
          ) : (
            <Pencil data-icon="inline-start" aria-hidden="true" />
          )}
          {archived ? "Просмотр" : "Изменить"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!imageUploadPending && !updateAchievement.isPending}
      >
        <DialogHeader>
          <DialogTitle>
            {archived ? "Архивная ачивка" : "Редактирование ачивки"}
          </DialogTitle>
          <DialogDescription>
            Версия {editingVersion}.{" "}
            {archived
              ? "Архивные записи доступны только для чтения."
              : achievement.status === "active"
                ? "Сохранение создаст черновик изменений. Текущие правила продолжат действовать до активации новой версии."
                : "Изменения останутся черновиком до активации."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submitForm}>
          <AchievementFormFields
            disabled={archived || updateAchievement.isPending}
            form={form}
            onImageSelectionChange={setImageSelected}
            onImageUploadPendingChange={setImageUploadPending}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button
                disabled={updateAchievement.isPending || imageUploadPending}
                type="button"
                variant="outline"
              >
                {archived ? "Закрыть" : "Отмена"}
              </Button>
            </DialogClose>
            {archived ? null : (
              <Button
                disabled={
                  updateAchievement.isPending ||
                  imageUploadPending ||
                  imageSelected
                }
                type="submit"
              >
                Сохранить
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
