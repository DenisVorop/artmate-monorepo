import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";

export function FilterField({
  label,
  value,
  className,
  ...props
}: ComponentProps<typeof Button> & { label: string; value: string }) {
  return (
    <Button
      {...props}
      type="button"
      variant="outline"
      aria-label={`${label}: ${value}`}
      className={cn(
        "h-auto min-h-16 w-full justify-between rounded-xl border-stone-200 bg-white px-4 py-3 text-left shadow-none",
        className,
      )}
    >
      <span className="min-w-0 space-y-1">
        <span className="block text-xs font-normal text-stone-500">{label}</span>
        <span className="block truncate text-base font-medium md:text-sm">{value}</span>
      </span>
      <ChevronDown className="ml-3 text-stone-400" />
    </Button>
  );
}
