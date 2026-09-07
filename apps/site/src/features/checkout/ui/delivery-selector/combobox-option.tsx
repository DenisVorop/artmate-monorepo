"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib";

type ComboboxOptionProps = {
  description?: string;
  icon?: ReactNode;
  isSelected: boolean;
  label: string;
  meta?: string;
  onSelect: () => void;
};

export function ComboboxOption({
  description,
  icon,
  isSelected,
  label,
  meta,
  onSelect,
}: ComboboxOptionProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-11 w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:bg-muted",
        isSelected && "bg-rose-50 text-rose-950",
      )}
      onClick={onSelect}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block font-medium">{label}</span>
        {meta ? <span className="block text-xs text-muted-foreground">{meta}</span> : null}
        {description ? (
          <span className="block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {isSelected ? <Check className="mt-0.5 size-4 shrink-0 text-rose-500" /> : null}
    </button>
  );
}
