import Image from "next/image";

import { cn, decline } from "@/shared/lib";

export function LoyaltyPoints({
  points,
  prefix = "",
  className,
  iconClassName,
}: {
  points: number;
  prefix?: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap tabular-nums", className)}
    >
      <span>
        {prefix}
        {points.toLocaleString("ru-RU")}
      </span>
      <Image
        src="/icons/loyalty-point.png"
        alt=""
        width={48}
        height={48}
        className={cn("size-4 shrink-0 object-contain", iconClassName)}
      />
      <span className="sr-only"> {decline(points, "балл", "балла", "баллов")}</span>
    </span>
  );
}
