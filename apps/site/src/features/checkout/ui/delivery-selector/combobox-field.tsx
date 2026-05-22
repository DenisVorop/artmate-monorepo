"use client";

import { ChevronsUpDown, LoaderCircle, Search } from "lucide-react";
import { Children, type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/shared/lib";
import { Button, Input, Label, Popover, PopoverContent, PopoverTrigger } from "@/shared/ui";

type ComboboxFieldProps = {
  children: ReactNode;
  disabled?: boolean;
  emptyText: string;
  inputValue: string;
  isOpen: boolean;
  isPending: boolean;
  label: string;
  onInputChange: (_value: string) => void;
  onOpenChange: (_isOpen: boolean) => void;
  placeholder: string;
  selectedLabel?: string;
  triggerLabel: string;
};

export function ComboboxField({
  children,
  disabled = false,
  emptyText,
  inputValue,
  isOpen,
  isPending,
  label,
  onInputChange,
  onOpenChange,
  placeholder,
  selectedLabel,
  triggerLabel,
}: ComboboxFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasOptions = Children.count(children) > 0;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={isOpen} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            role="combobox"
            aria-expanded={isOpen}
            className={cn(
              "h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal whitespace-normal",
              !selectedLabel && "text-muted-foreground",
            )}
          >
            <span className="line-clamp-2 min-w-0">{triggerLabel}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder={placeholder}
                className="pl-9"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-1">
            {isPending ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Загружаем
              </div>
            ) : hasOptions ? (
              children
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
