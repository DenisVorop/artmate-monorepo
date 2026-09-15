"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Button, Checkbox, Input, Textarea } from "@/shared/ui";

import type { ProductFormValues } from "../lib";
import { LabeledField } from "./form-controls";

type ProductCharacteristicsFieldsProps = {
  readonly control: Control<ProductFormValues>;
  readonly disabled: boolean;
  readonly errors: FieldErrors<ProductFormValues>;
  readonly register: UseFormRegister<ProductFormValues>;
};

export function ProductCharacteristicsFields({
  control,
  disabled,
  errors,
  register,
}: ProductCharacteristicsFieldsProps) {
  const id = useId();
  const { fields, append, move, remove } = useFieldArray({
    control,
    name: "characteristics",
  });
  const characteristics = useWatch({ control, name: "characteristics" });
  const highlightedCount = characteristics.filter(
    (item) => item.isHighlighted,
  ).length;
  const arrayError =
    errors.characteristics?.root?.message ?? errors.characteristics?.message;

  return (
    <>
      <section
        aria-labelledby={`${id}-heading`}
        className="grid gap-3 border-t pt-4"
      >
        <div className="grid gap-1">
          <h3 className="text-sm font-medium" id={`${id}-heading`}>
            Характеристики
          </h3>
          <p className="text-sm text-muted-foreground" id={`${id}-help`}>
            Добавьте до 30 характеристик. Порядок строк определяет порядок на
            сайте. Рядом с ценой можно показать до двух характеристик.
          </p>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            Выбрано для краткого блока: {highlightedCount} из 2
          </p>
        </div>
        {fields.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Характеристик пока нет. Пустой блок не показывается на сайте.
          </p>
        )}
        <ol aria-describedby={`${id}-help`} className="grid gap-3">
          {fields.map((item, index) => {
            const rowErrors = errors.characteristics?.[index];
            const nameErrorId = `${id}-${item.id}-name-error`;
            const valueErrorId = `${id}-${item.id}-value-error`;

            return (
              <li className="grid gap-3 rounded-lg border p-3" key={item.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Характеристика {index + 1}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      aria-label={`Переместить характеристику ${index + 1} выше`}
                      disabled={disabled || index === 0}
                      onClick={() => move(index, index - 1)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`Переместить характеристику ${index + 1} ниже`}
                      disabled={disabled || index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`Удалить характеристику ${index + 1}`}
                      disabled={disabled}
                      onClick={() => remove(index)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <LabeledField
                    label="Название"
                    error={rowErrors?.name?.message}
                    errorId={nameErrorId}
                  >
                    <Input
                      aria-describedby={
                        rowErrors?.name ? nameErrorId : undefined
                      }
                      aria-invalid={Boolean(rowErrors?.name)}
                      disabled={disabled}
                      maxLength={80}
                      placeholder="Количество цветов"
                      {...register(`characteristics.${index}.name`)}
                    />
                  </LabeledField>
                  <LabeledField
                    label="Значение"
                    error={rowErrors?.value?.message}
                    errorId={valueErrorId}
                  >
                    <Input
                      aria-describedby={
                        rowErrors?.value ? valueErrorId : undefined
                      }
                      aria-invalid={Boolean(rowErrors?.value)}
                      disabled={disabled}
                      maxLength={500}
                      placeholder="168"
                      {...register(`characteristics.${index}.value`)}
                    />
                  </LabeledField>
                </div>
                <Controller
                  control={control}
                  name={`characteristics.${index}.isHighlighted`}
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value}
                        disabled={
                          disabled || (!field.value && highlightedCount >= 2)
                        }
                        name={field.name}
                        onBlur={field.onBlur}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                        ref={field.ref}
                      />
                      Показывать рядом с ценой
                    </label>
                  )}
                />
              </li>
            );
          })}
        </ol>
        {arrayError && (
          <p className="text-sm text-destructive" role="alert">
            {arrayError}
          </p>
        )}
        <Button
          className="justify-self-start"
          disabled={disabled || fields.length >= 30}
          onClick={() => append({ name: "", value: "", isHighlighted: false })}
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" /> Добавить характеристику
        </Button>
      </section>
      <LabeledField
        label="Как пользоваться"
        error={errors.usageInstructions?.message}
        errorId={`${id}-usage-error`}
      >
        <Textarea
          aria-describedby={`${id}-usage-help${errors.usageInstructions ? ` ${id}-usage-error` : ""}`}
          aria-invalid={Boolean(errors.usageInstructions)}
          disabled={disabled}
          maxLength={6000}
          placeholder="Инструкция для этого товара"
          rows={6}
          {...register("usageInstructions")}
        />
        <span className="text-xs text-muted-foreground" id={`${id}-usage-help`}>
          Необязательно. Обычный текст до 6000 символов. Если поле пустое,
          вкладка на сайте скрыта.
        </span>
      </LabeledField>
    </>
  );
}
