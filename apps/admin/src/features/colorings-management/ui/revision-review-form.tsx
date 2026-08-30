"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Send } from "lucide-react";

import { Button, Textarea } from "@/shared/ui";

import {
  coloringReviewSchema,
  getColoringReviewInput,
  type ColoringReviewValues,
} from "../lib";
import { useReviewColoringRevision } from "../model";
import { fieldClassName, FormField } from "./form-field";

export function RevisionReviewForm({
  coloringId,
  disabled,
  revisionId,
}: {
  readonly coloringId: string;
  readonly disabled: boolean;
  readonly revisionId: string;
}) {
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<ColoringReviewValues>({
    defaultValues: { comment: "", decision: "approved" },
    resolver: zodResolver(coloringReviewSchema),
  });
  const { isPending, mutate } = useReviewColoringRevision({ onSuccess: () => reset() });
  const decision = watch("decision");

  return (
    <form
      className="grid gap-3 rounded-lg border bg-muted/20 p-3"
      onSubmit={handleSubmit((values) => {
        if (!disabled) {
          mutate({ coloringId, input: getColoringReviewInput(values), revisionId });
        }
      })}
    >
      <p className="text-sm font-medium">Одноразовое ревью</p>
      <FormField error={errors.decision?.message} label="Решение">
        <select
          className={fieldClassName}
          disabled={disabled || isPending}
          {...register("decision")}
        >
          <option value="approved">Одобрить</option>
          <option value="rejected">Отклонить</option>
        </select>
      </FormField>
      <FormField error={errors.comment?.message} label={decision === "rejected" ? "Причина отклонения" : "Комментарий (необязательно)"}>
        <Textarea
          disabled={disabled || isPending}
          rows={3}
          {...register("comment")}
        />
      </FormField>
      <div>
        <Button
          disabled={disabled || isPending}
          size="sm"
          type="submit"
          variant="outline"
        >
          <Send data-icon="inline-start" aria-hidden="true" />
          {isPending ? "Сохраняем..." : "Отправить решение"}
        </Button>
      </div>
    </form>
  );
}
