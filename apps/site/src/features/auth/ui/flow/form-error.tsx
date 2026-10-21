import { cn } from "@/shared/lib/utils";

export function FormError({
  id,
  message,
  className,
  reserveSpace = false,
}: {
  id?: string;
  message?: string;
  className?: string;
  reserveSpace?: boolean;
}) {
  if (!message && !reserveSpace) return null;

  return (
    <div className={cn(reserveSpace && "min-h-4", className)}>
      {message && (
        <p id={id} role="alert" className="text-xs leading-4 wrap-anywhere text-rose-700">
          {message}
        </p>
      )}
    </div>
  );
}
