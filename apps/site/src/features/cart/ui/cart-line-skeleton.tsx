import { Card, CardContent } from "@/shared/ui";

export function CartLineSkeleton() {
  return (
    <Card className="overflow-hidden py-0" aria-hidden="true">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div className="aspect-[3/4] rounded-lg bg-muted motion-safe:animate-pulse" />

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0 space-y-3">
            <div className="h-3 w-24 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-5 w-full max-w-sm rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted motion-safe:animate-pulse" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
            <div className="h-10 w-32 rounded-lg border bg-muted/60 motion-safe:animate-pulse" />
            <div className="h-8 w-28 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
