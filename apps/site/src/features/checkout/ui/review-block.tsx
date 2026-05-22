"use client";

import { cn } from "@/shared/lib";

type ReviewBlockProps = {
  className?: string;
  label: string;
  value: string;
};

export function ReviewBlock({ className, label, value }: ReviewBlockProps) {
  return (
    <div className={cn("rounded-lg border bg-muted/30 px-3 py-2 text-sm", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium break-words">{value}</p>
    </div>
  );
}
