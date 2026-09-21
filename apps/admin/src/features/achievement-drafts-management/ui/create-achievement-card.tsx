"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import {
  achievementDraftFormSchema,
  createAchievementDraftDefaultValues,
  toCreateAchievementDraftInput,
  type AchievementDraftFormValues,
} from "../lib";
import { useCreateAchievementDraft } from "../model";
import { AchievementFormFields } from "./achievement-form-fields";

export function CreateAchievementCard() {
  const [imageSelected, setImageSelected] = useState(false);
  const [imageUploadPending, setImageUploadPending] = useState(false);
  const form = useForm<AchievementDraftFormValues>({
    defaultValues: createAchievementDraftDefaultValues,
    resolver: zodResolver(achievementDraftFormSchema),
  });
  const createAchievement = useCreateAchievementDraft({
    onSuccess: () => {
      form.reset(createAchievementDraftDefaultValues);
      setImageSelected(false);
      setImageUploadPending(false);
    },
  });
  const submitForm = form.handleSubmit((values) => {
    if (createAchievement.isPending || imageUploadPending || imageSelected)
      return;
    createAchievement.mutate(toCreateAchievementDraftInput(values));
  });

  return (
    <Card className="xl:sticky xl:top-8 xl:self-start">
      <CardHeader>
        <CardTitle>Новая ачивка</CardTitle>
        <CardDescription>
          Создаётся только черновик. Укажите размер награды вручную.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submitForm}>
          <AchievementFormFields
            disabled={createAchievement.isPending}
            form={form}
            onImageSelectionChange={setImageSelected}
            onImageUploadPendingChange={setImageUploadPending}
          />
          <Button
            disabled={
              createAchievement.isPending || imageUploadPending || imageSelected
            }
            type="submit"
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            Создать черновик
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
