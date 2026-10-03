"use client";

import type { ReactNode } from "react";

type MapPlaceholderProps = {
  children: ReactNode;
  icon: ReactNode;
  title?: string;
};

export function MapPlaceholder({ children, icon, title }: MapPlaceholderProps) {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-lg border bg-muted/30 px-4 text-center text-sm text-muted-foreground md:min-h-96">
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
