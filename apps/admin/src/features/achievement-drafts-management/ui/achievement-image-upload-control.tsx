"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button, Input } from "@/shared/ui";

import {
  achievementImageUploadFormSchema,
  getAchievementImageUploadFormData,
  type AchievementImageUploadFormValues,
} from "../lib";
import { useUploadAchievementImage } from "../model";

type AchievementImageUploadControlProps = {
  readonly error?: string;
  readonly imageUrl: string;
  readonly onImageUrlChange: (url: string) => void;
  readonly onSelectionChange: (selected: boolean) => void;
  readonly onUploadPendingChange: (pending: boolean) => void;
  readonly readOnly?: boolean;
};

export function AchievementImageUploadControl({
  error,
  imageUrl,
  onImageUrlChange,
  onSelectionChange,
  onUploadPendingChange,
  readOnly = false,
}: AchievementImageUploadControlProps) {
  const [inputKey, setInputKey] = useState(0);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>();
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<AchievementImageUploadFormValues>({
    defaultValues: {},
    resolver: zodResolver(achievementImageUploadFormSchema),
  });
  const selectedFile = watch("file")?.item(0);
  const uploadImage = useUploadAchievementImage();

  useEffect(() => {
    onSelectionChange(Boolean(selectedFile));
  }, [onSelectionChange, selectedFile]);

  useEffect(() => {
    onUploadPendingChange(uploadImage.isPending);
  }, [onUploadPendingChange, uploadImage.isPending]);

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewUrl(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setLocalPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const clearSelection = () => {
    reset({});
    setInputKey((value) => value + 1);
  };
  const submitUpload = handleSubmit((values) => {
    uploadImage.mutate(getAchievementImageUploadFormData(values), {
      onSuccess: (image) => {
        onImageUrlChange(image.url);
        clearSelection();
      },
    });
  });
  const previewUrl = localPreviewUrl ?? imageUrl;

  return (
    <div className="grid gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        Изображение
      </span>
      {previewUrl ? (
        <div className="relative flex aspect-[16/9] max-h-56 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Предпросмотр ачивки"
            className="size-full object-contain"
            src={previewUrl}
          />
        </div>
      ) : (
        <div className="flex min-h-28 items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
          <ImageIcon className="size-4" aria-hidden="true" />
          Изображение не выбрано
        </div>
      )}

      {readOnly ? null : (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input
            aria-label="Файл изображения ачивки"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploadImage.isPending}
            key={inputKey}
            type="file"
            {...register("file")}
          />
          <Button
            disabled={uploadImage.isPending || !selectedFile}
            onClick={() => void submitUpload()}
            type="button"
            variant="outline"
          >
            <Upload data-icon="inline-start" aria-hidden="true" />
            {imageUrl ? "Заменить" : "Загрузить"}
          </Button>
          <Button
            aria-label="Удалить изображение"
            disabled={uploadImage.isPending || (!imageUrl && !selectedFile)}
            onClick={() => {
              clearSelection();
              onImageUrlChange("");
            }}
            size="icon"
            type="button"
            variant="outline"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      )}
      {selectedFile && imageUrl ? (
        <p className="text-xs text-muted-foreground">
          Сначала загрузите выбранный файл, чтобы заменить текущее изображение.
        </p>
      ) : null}
      {readOnly ? null : (
        <p className="text-xs text-muted-foreground">
          JPG, PNG или WebP. До 5 МБ.
        </p>
      )}
      {errors.file?.message || error ? (
        <p className="text-xs text-destructive" role="alert">
          {errors.file?.message ?? error}
        </p>
      ) : null}
    </div>
  );
}
