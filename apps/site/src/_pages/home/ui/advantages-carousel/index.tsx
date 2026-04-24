import { InfiniteCarousel } from "@/shared/ui/infinite-carousel";

export function AdvantagesCarousel({ advantages }: { advantages: string[] }) {
  return (
    <InfiniteCarousel
      className="border-y border-stone-200 bg-white py-3 select-none"
      trackClassName="flex whitespace-nowrap"
    >
      {advantages.map((item) => (
        <span
          key={item}
          className="mr-8 inline-flex items-center gap-3 text-sm font-medium text-stone-500"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" />
          {item}
        </span>
      ))}
    </InfiniteCarousel>
  );
}
