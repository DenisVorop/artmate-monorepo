"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Upload } from "lucide-react";

import type { MarkerColor } from "@/entities/marker-colors";
import { Button, Input } from "@/shared/ui";

import {
  coloringRevisionDefaultValues,
  coloringRevisionSchema,
  getColoringRevisionFormData,
  type ColoringRevisionValues,
} from "../lib";
import { useCreateColoringRevision } from "../model";
import { FormField } from "./form-field";
import { PaletteEditor } from "./palette-editor";

export function RevisionUploadForm({
  coloringId,
  disabled,
  disabledLabel,
  markerColors,
}: {
  readonly coloringId: string;
  readonly disabled: boolean;
  readonly disabledLabel?: string;
  readonly markerColors: readonly MarkerColor[];
}) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<ColoringRevisionValues>({
    defaultValues: coloringRevisionDefaultValues,
    resolver: zodResolver(coloringRevisionSchema),
  });
  const { isPending, mutate } = useCreateColoringRevision({
    onSuccess: () => reset(coloringRevisionDefaultValues),
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={handleSubmit((values) => {
        if (!disabled) {
          mutate({ coloringId, formData: getColoringRevisionFormData(values) });
        }
      })}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4 rounded-lg border p-4">
          <FormField
            error={errors.outline?.message}
            label="Контур, PNG или WebP"
          >
            <Input
              accept="image/png,image/webp"
              disabled={disabled || isPending}
              type="file"
              {...register("outline")}
            />
          </FormField>
          <FormField error={errors.outlineAlt?.message} label="Alt контура">
            <Input
              disabled={disabled || isPending}
              {...register("outlineAlt")}
            />
          </FormField>
        </div>
        <div className="grid gap-4 rounded-lg border p-4">
          <FormField
            error={errors.colored?.message}
            label="Цветной образец, PNG или WebP"
          >
            <Input
              accept="image/png,image/webp"
              disabled={disabled || isPending}
              type="file"
              {...register("colored")}
            />
          </FormField>
          <FormField
            error={errors.coloredAlt?.message}
            label="Alt цветного образца"
          >
            <Input
              disabled={disabled || isPending}
              {...register("coloredAlt")}
            />
          </FormField>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Каждый файл: не более 20 МиБ.
      </p>
      <PaletteEditor
        control={control}
        disabled={disabled || isPending}
        markerColors={markerColors}
      />
      <div>
        <Button disabled={disabled || isPending} type="submit">
          <Upload data-icon="inline-start" aria-hidden="true" />
          {disabled
            ? (disabledLabel ?? "Раскраска в архиве")
            : isPending
              ? "Загружаем пару..."
              : "Создать ревизию"}
        </Button>
      </div>
    </form>
  );
}
