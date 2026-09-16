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

      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl bg-muted">
        <div className="min-w-0 bg-ink px-4 py-4 text-white">
          <p className="text-xs font-bold text-white/60">Вам</p>
          <p className="font-heading mt-1 text-2xl font-bold">
            {split.partnerPercent}%
          </p>
        </div>
        <div className="min-w-0 px-4 py-4 text-right">
          <p className="text-xs font-bold text-muted-foreground">Покупателю</p>
          <p className="font-heading mt-1 text-2xl font-bold text-rose-600">
            {split.buyerPercent}%
          </p>
        </div>
      </div>
      <div
        className="mt-2 grid h-2 gap-0.5 overflow-hidden rounded-full"
        style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
        aria-hidden="true"
      >
        {Array.from({ length: 20 }, (_, index) => (
          <span
            className={index < value ? "bg-ink" : "bg-rose-400"}
            key={index}
          />
        ))}
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
