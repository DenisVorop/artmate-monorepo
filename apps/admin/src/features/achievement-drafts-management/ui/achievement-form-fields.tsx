import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";

import {
  getAchievementConditionLabel,
  type AchievementConditionKind,
} from "@/entities/achievement-drafts";
import { Input, NativeSelect, NativeSelectOption, Textarea } from "@/shared/ui";

import {
  achievementDraftConditionKinds,
  type AchievementDraftFormValues,
} from "../lib";
import { AchievementImageUploadControl } from "./achievement-image-upload-control";

type AchievementFormFieldsProps = {
  readonly disabled?: boolean;
  readonly form: UseFormReturn<AchievementDraftFormValues>;
  readonly onImageSelectionChange: (selected: boolean) => void;
  readonly onImageUploadPendingChange: (pending: boolean) => void;
};

export function AchievementFormFields({
  disabled = false,
  form,
  onImageSelectionChange,
  onImageUploadPendingChange,
}: AchievementFormFieldsProps) {
  const {
    formState: { errors },
    register,
  } = form;

  return (
    <fieldset className="grid gap-3" disabled={disabled}>
      <LabeledField error={errors.title?.message} label="Название">
        <Input
          aria-invalid={Boolean(errors.title)}
          maxLength={120}
          {...register("title")}
        />
      </LabeledField>
      <LabeledField error={errors.description?.message} label="Описание">
        <Textarea
          aria-invalid={Boolean(errors.description)}
          maxLength={1000}
          rows={4}
          {...register("description")}
        />
      </LabeledField>
      <AchievementImageUploadControl
        error={errors.imageUrl?.message}
        imageUrl={form.watch("imageUrl")}
        onImageUrlChange={(imageUrl) =>
          form.setValue("imageUrl", imageUrl, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        onSelectionChange={onImageSelectionChange}
        onUploadPendingChange={onImageUploadPendingChange}
        readOnly={disabled}
      />
      <LabeledField error={errors.conditionKind?.message} label="Условие">
        <NativeSelect
          aria-invalid={Boolean(errors.conditionKind)}
          className="w-full"
          {...register("conditionKind")}
        >
          {achievementDraftConditionKinds.map((condition) => (
            <NativeSelectOption key={condition} value={condition}>
              {getAchievementConditionLabel(
                condition as AchievementConditionKind,
              )}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </LabeledField>
      {form.watch("conditionKind") === "distinct_collection_count" ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Цель — количество тематик, в каждой из которых есть хотя бы одна
          одобренная публичная работа. Например, 5 картин из «Цветов» — это 5
          работ и 1 тематика. Бонусы за каждую картину начисляются отдельно.
        </p>
      ) : null}
      {form.watch("conditionKind") === "completed_collection_count" ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Цель — количество полностью раскрашенных альбомов. В каждом нужна
          одобренная публичная работа на каждую картину. Состав альбома
          фиксируется автоматически, когда загружены все заявленные картины;
          неполные альбомы не засчитываются. Уже засчитанный альбом сохраняется
          в прогрессе.
        </p>
      ) : null}
      {form.watch("conditionKind") === "completed_order_count" ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Цель — количество оплаченных и завершённых заказов. Промокоды и
          списание баллов не мешают получить ачивку. До её получения полностью
          возвращённый заказ не учитывается; частично возвращённый учитывается,
          если у покупателя остался хотя бы один товар. Полученная награда
          сохраняется после возврата.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <LabeledField error={errors.target?.message} label="Цель">
          <Input
            aria-invalid={Boolean(errors.target)}
            max={2_147_483_647}
            min={1}
            type="number"
            {...register("target", { valueAsNumber: true })}
          />
        </LabeledField>
        <LabeledField
          error={errors.rewardPoints?.message}
          label="Награда, баллы"
        >
          <Input
            aria-invalid={Boolean(errors.rewardPoints)}
            max={2_147_483_647}
            min={0}
            type="number"
            {...register("rewardPoints")}
          />
        </LabeledField>
        <LabeledField error={errors.sortOrder?.message} label="Порядок">
          <Input
            aria-invalid={Boolean(errors.sortOrder)}
            max={2_147_483_647}
            min={0}
            type="number"
            {...register("sortOrder", { valueAsNumber: true })}
          />
        </LabeledField>
      </div>
    </fieldset>
  );
}

function LabeledField({
  children,
  error,
  label,
}: {
  readonly children: ReactNode;
  readonly error?: string;
  readonly label: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
