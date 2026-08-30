"use client";

import { type Ref, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import type { MarkerColor } from "@/entities/marker-colors";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui";

export function MarkerColorCombobox({
  describedBy,
  disabled,
  invalid,
  markerColors,
  onBlur,
  onChange,
  selectedIds,
  symbol,
  triggerRef,
  value,
}: {
  readonly describedBy?: string;
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly markerColors: readonly MarkerColor[];
  readonly onBlur: () => void;
  readonly onChange: (markerColorId: string) => void;
  readonly selectedIds: readonly string[];
  readonly symbol: string;
  readonly triggerRef: Ref<HTMLButtonElement>;
  readonly value: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedColor = markerColors.find((color) => color.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={invalid}
          aria-label={
            selectedColor
              ? `Маркер для символа ${symbol}: маркер ${selectedColor.markerNumber}, цвет ${selectedColor.colorNumber}, ${selectedColor.hex}`
              : `Маркер для символа ${symbol}: не выбран`
          }
          className="h-auto min-h-10 w-full justify-between px-3 py-2 font-normal"
          disabled={disabled}
          onBlur={onBlur}
          ref={triggerRef}
          role="combobox"
          type="button"
          variant="outline"
        >
          {selectedColor ? (
            <MarkerColorSummary color={selectedColor} compact />
          ) : (
            <span className="text-muted-foreground">Выберите маркер</span>
          )}
          <ChevronsUpDown aria-hidden="true" className="ml-2 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput
            aria-label={`Поиск маркера для символа ${symbol}`}
            placeholder="Номер, Pantone или HEX"
          />
          <CommandList>
            <CommandEmpty>Маркер не найден</CommandEmpty>
            <CommandGroup>
              {markerColors.map((color) => {
                const isSelected = color.id === value;
                const isUsedElsewhere =
                  !isSelected && selectedIds.includes(color.id);

                return (
                  <CommandItem
                    data-checked={isSelected}
                    disabled={isUsedElsewhere}
                    key={color.id}
                    onSelect={() => {
                      onChange(color.id);
                      setOpen(false);
                    }}
                    value={[
                      color.id,
                      color.markerNumber,
                      color.colorNumber,
                      color.pantone,
                      color.hex,
                    ].join(" ")}
                  >
                    <MarkerColorSummary color={color} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MarkerColorSummary({
  color,
  compact = false,
}: {
  readonly color: MarkerColor;
  readonly compact?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
      <span
        aria-hidden="true"
        className="size-7 shrink-0 rounded-md border shadow-xs"
        style={{ backgroundColor: color.hex }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          Маркер {color.markerNumber}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {compact ? (
            <>
              {color.hex} · Pantone {color.pantone}
            </>
          ) : (
            <>
              Цвет {color.colorNumber} · Pantone {color.pantone} · {color.hex}
            </>
          )}
        </span>
      </span>
    </span>
  );
}
