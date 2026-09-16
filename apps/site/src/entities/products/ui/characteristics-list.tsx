import { cn } from "@/shared/lib/utils";
import type { ProductCharacteristic } from "../model";

type CharacteristicsListProps = {
  characteristics: ProductCharacteristic[];
  columns?: 1 | 2;
};

export function CharacteristicsList({ characteristics, columns = 1 }: CharacteristicsListProps) {
  return (
    <dl
      className={cn(
        "grid min-w-0 text-sm leading-5",
        columns === 2 && "md:grid-cols-2 md:gap-x-12 lg:gap-x-16",
      )}
    >
      {characteristics.map((item) => (
        <div
          key={item.name}
          className="grid min-w-0 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] content-start gap-x-4 border-b border-border py-2.5"
        >
          <dt className="min-w-0 wrap-anywhere text-muted-foreground">{item.name}</dt>
          <dd className="min-w-0 wrap-anywhere whitespace-pre-line">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
