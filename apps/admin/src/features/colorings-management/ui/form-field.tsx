import type { ReactNode } from "react";

export const fieldClassName =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function FormField({
  children,
  error,
  label,
}: {
  readonly children: ReactNode;
  readonly error?: string;
  readonly label: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
