"use client";

import { Controller, type UseFormReturn } from "react-hook-form";

import type { MaterialSetDetail } from "@/entities/material-sets";
import { Checkbox, Input, NativeSelect, NativeSelectOption } from "@/shared/ui";

import { symbols, type UploadFormValues } from "../lib/form-values";

type Props = {
  readonly form: UseFormReturn<UploadFormValues>;
  readonly rows: UploadFormValues["palette"];
  readonly original: boolean;
  readonly lockSymbols: boolean;
  readonly materialSet?: MaterialSetDetail;
};

export function PaletteFields({
  form,
  rows,
  original,
  lockSymbols,
  materialSet,
}: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  return (
    <div className="grid gap-3">
      <h3 className="font-medium">Обозначения на раскраске</h3>
      <p className="text-sm text-muted-foreground">
        {original
          ? "Отметьте обозначения, которые есть на изображении, и укажите их цвета. Пропуски допустимы."
          : "Выберите цвет набора для каждого обозначения оригинала. Один цвет можно использовать несколько раз."}
      </p>
      {original && lockSymbols && (
        <p className="text-sm text-muted-foreground">
          Обозначения уже используются в адаптациях, поэтому их список нельзя
          изменить.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row, index) => {
          if (!original && !row.enabled) return null;
          const symbol = symbols[row.symbolPosition - 1];
          const issue =
            errors.palette?.[index]?.[original ? "hex" : "materialColorId"]
              ?.message;
          const color = original
            ? row.hex
            : materialSet?.colors.find(
                (item) => item.id === row.materialColorId,
              )?.hex;
          return (
            <div
              key={row.symbolPosition}
              className="grid content-start gap-2 rounded-lg border p-3"
            >
              <div className="flex items-center gap-2">
                {original && (
                  <Controller
                    name={`palette.${index}.enabled`}
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id={`variant-symbol-${row.symbolPosition}`}
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                        disabled={lockSymbols}
                        aria-label={`Использовать обозначение ${symbol}`}
                      />
                    )}
                  />
                )}
                <label
                  className="font-medium"
                  htmlFor={
                    original
                      ? `variant-symbol-${row.symbolPosition}`
                      : `variant-color-${row.symbolPosition}`
                  }
                >
                  {symbol}
                </label>
                {color && /^#[0-9a-f]{6}$/i.test(color) && (
                  <span
                    aria-hidden="true"
                    className="ml-auto size-5 rounded border"
                    style={{ backgroundColor: color }}
                  />
                )}
              </div>
              {row.enabled &&
                (original ? (
                  <Input
                    {...register(`palette.${index}.hex`)}
                    id={`variant-color-${row.symbolPosition}`}
                    placeholder="#AABBCC"
                    maxLength={7}
                    aria-label={`Цвет обозначения ${symbol}`}
                    aria-invalid={Boolean(issue)}
                    aria-describedby={
                      issue
                        ? `variant-color-error-${row.symbolPosition}`
                        : undefined
                    }
                  />
                ) : (
                  <NativeSelect
                    {...register(`palette.${index}.materialColorId`)}
                    id={`variant-color-${row.symbolPosition}`}
                    className="w-full"
                    aria-invalid={Boolean(issue)}
                    aria-describedby={
                      issue
                        ? `variant-color-error-${row.symbolPosition}`
                        : undefined
                    }
                  >
                    <NativeSelectOption value="">
                      Выберите цвет
                    </NativeSelectOption>
                    {materialSet?.colors.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.code}
                        {item.name ? ` — ${item.name}` : ""}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ))}
              {issue && (
                <p
                  id={`variant-color-error-${row.symbolPosition}`}
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {issue}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {errors.palette?.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {errors.palette.root.message}
        </p>
      )}
    </div>
  );
}
