export function CartLineSkeleton() {
  return (
    <div className="rounded-lg border bg-background p-3 sm:p-4" aria-hidden="true">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="aspect-square rounded-md bg-muted motion-safe:animate-pulse" />

        <div className="min-w-0 self-center space-y-2">
          <div className="h-3 w-20 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-5 w-full max-w-sm rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted motion-safe:animate-pulse" />
        </div>

        <div className="col-span-2 flex items-center justify-between gap-3 border-t pt-3 sm:col-span-1 sm:border-t-0 sm:pt-0">
          <div className="h-8 w-28 rounded-md border bg-muted/60 motion-safe:animate-pulse" />
          <div className="h-7 w-24 rounded bg-muted motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
