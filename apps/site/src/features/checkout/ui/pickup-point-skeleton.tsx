export function PickupPointSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]" aria-hidden="true">
      <div className="aspect-[4/3] min-h-80 rounded-lg border bg-muted motion-safe:animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-lg border bg-muted motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
