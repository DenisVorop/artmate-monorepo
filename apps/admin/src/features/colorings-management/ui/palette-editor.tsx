"use client";

import {
  Controller,
  type Control,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import type { MarkerColor } from "@/entities/marker-colors";
import { Badge, Button } from "@/shared/ui";

import { coloringPaletteSymbols, type ColoringRevisionValues } from "../lib";
import { MarkerColorCombobox } from "./marker-color-combobox";

export function PaletteEditor({
  control,
  disabled,
  markerColors,
}: {
  readonly control: Control<ColoringRevisionValues>;
  readonly disabled: boolean;
  readonly markerColors: readonly MarkerColor[];
}) {
  const { append, fields, remove } = useFieldArray({
    control,
    name: "paletteColors",
  });
  const paletteColors = useWatch({ control, name: "paletteColors" });
  const selectedIds = paletteColors.map(({ markerColorId }) => markerColorId);
  const hasEmptySelection = selectedIds.some((id) => !id);

  return (
    <section className="grid gap-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h3 className="font-medium">Палитра Artmate 168</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Выберите маркеры в порядке цветов на изображении. Символы
            назначаются автоматически: сначала 1–9, затем A–J.
          </p>
        </div>
        <Badge className="w-fit" variant="outline">
          {fields.length} из {coloringPaletteSymbols.length}
        </Badge>
      </div>

      <div className="grid gap-3">
        {fields.map((field, index) => {
          const symbol = coloringPaletteSymbols[index];
          const errorId = `palette-color-${field.id}-error`;

          if (!symbol) return null;

          return (
            <div
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-start gap-2"
              key={field.id}
            >
              <div
                aria-label={`Символ ${symbol}`}
                className="flex size-10 items-center justify-center rounded-lg bg-foreground font-mono text-sm font-semibold text-background"
              >
                {symbol}
              </div>
              <Controller
                control={control}
                name={`paletteColors.${index}.markerColorId`}
                render={({ field: markerColorField, fieldState }) => (
                  <div className="grid gap-1">
                    <MarkerColorCombobox
                      describedBy={fieldState.error ? errorId : undefined}
                      disabled={disabled}
                      invalid={Boolean(fieldState.error)}
                      markerColors={markerColors}
                      onBlur={markerColorField.onBlur}
                      onChange={markerColorField.onChange}
                      selectedIds={selectedIds}
                      symbol={symbol}
                      triggerRef={markerColorField.ref}
                      value={markerColorField.value}
                    />
                    {fieldState.error?.message ? (
                      <p className="text-xs text-destructive" id={errorId}>
                        {fieldState.error.message}
                      </p>
                    ) : null}
                  </div>
                )}
              />
              <Button
                aria-label={`Удалить цвет ${symbol}`}
                disabled={disabled || fields.length === 1}
                onClick={() => remove(index)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          При удалении цвета следующие символы сдвинутся на одну позицию.
        </p>
        <Button
          className="w-fit"
          disabled={
            disabled ||
            hasEmptySelection ||
            fields.length >= coloringPaletteSymbols.length
          }
          onClick={() => append({ markerColorId: "" })}
          type="button"
          variant="outline"
        >
          <Plus data-icon="inline-start" aria-hidden="true" />
          Добавить цвет
        </Button>
      </div>
    </section>
  );
}
