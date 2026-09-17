"use client";

import { useId } from "react";

import { Button, Slider } from "@/shared/ui";

import { getCommissionSplit } from "../lib";

type CommissionSplitProps = {
  readonly disabled?: boolean;
  readonly onChange: (value: number) => void;
  readonly value: number;
};

const presets = [0, 5, 10, 15] as const;

export function CommissionSplit({
  disabled,
  onChange,
  value,
}: CommissionSplitProps) {
  const fieldId = useId();
  const split = getCommissionSplit(value);

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="text-sm font-extrabold text-ink">
        Распределение 20%
      </legend>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Выберите вашу долю. Остальное станет скидкой покупателю.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-2xl border border-border/70 bg-muted/45 px-3 py-4 sm:px-4">
          <p className="text-xs font-bold text-muted-foreground">Вам</p>
          <p className="font-heading mt-1 break-words text-2xl font-bold text-ink">
            {split.partnerPercent}%
          </p>
        </div>
        <div className="min-w-0 rounded-2xl border border-border/70 bg-muted/45 px-3 py-4 text-right sm:px-4">
          <p className="text-xs font-bold text-muted-foreground">Покупателю</p>
          <p className="font-heading mt-1 break-words text-2xl font-bold text-ink">
            {split.buyerPercent}%
          </p>
        </div>
      </div>
      <div
        className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <span
          className="shrink-0 bg-ink"
          style={{ flexBasis: `${split.partnerPercent * 5}%` }}
        />
        <span
          className="shrink-0 bg-rose-400"
          style={{ flexBasis: `${split.buyerPercent * 5}%` }}
        />
      </div>

      <p className="mt-5 block text-sm font-bold" id={`${fieldId}-label`}>
        Ваша доля: {value}%
      </p>
      <Slider
        className="mt-3 py-2"
        disabled={disabled}
        max={15}
        min={0}
        onValueChange={(nextValue) => onChange(nextValue[0] ?? 0)}
        step={1}
        thumbProps={{
          "aria-describedby": `${fieldId}-hint`,
          "aria-labelledby": `${fieldId}-label`,
          "aria-valuetext": `Вам ${split.partnerPercent}%, покупателю ${split.buyerPercent}%`,
        }}
        value={[value]}
      />
      <p className="sr-only" id={`${fieldId}-hint`}>
        Допустимое значение от 0 до 15 процентов, шаг 1 процент.
      </p>
      <div
        className="mt-3 grid grid-cols-4 gap-2"
        aria-label="Быстрый выбор доли"
      >
        {presets.map((preset) => (
          <Button
            aria-pressed={value === preset}
            className="px-2"
            key={preset}
            onClick={() => onChange(preset)}
            size="sm"
            type="button"
            variant={value === preset ? "default" : "outline"}
          >
            {preset}%
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
