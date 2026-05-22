"use client";

import type { ReactNode } from "react";

import { cn } from "@/shared/lib";

type MapPlaceholderProps = {
  children: ReactNode;
  compact?: boolean;
  icon: ReactNode;
  title?: string;
};

export function MapPlaceholder({ children, compact = false, icon, title }: MapPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex min-h-52 items-center justify-center rounded-lg border bg-muted/30 px-4 text-center text-sm text-muted-foreground",
        !compact && "min-h-72 md:min-h-96",
      )}
    >
      <div className="flex max-w-80 flex-col items-center justify-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
          {icon}
        </span>
        {title ? <span className="font-medium text-foreground">{title}</span> : null}
        <span>{children}</span>
      </div>
    </div>
  );
}
