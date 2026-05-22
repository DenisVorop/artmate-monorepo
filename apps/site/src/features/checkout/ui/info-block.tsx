"use client";

import type { ReactNode } from "react";

type InfoBlockProps = {
  title: string;
  children: ReactNode;
};

export function InfoBlock({ title, children }: InfoBlockProps) {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">{title}</p>
      <div className="space-y-1 text-muted-foreground">{children}</div>
    </div>
  );
}
