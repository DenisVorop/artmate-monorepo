"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEventHandler } from "react";
import { routes } from "@/shared/constants";
import { cn, shouldBypassNextImageOptimization } from "@/shared/lib";
import { Button } from "@/shared/ui/button";
import { Link } from "@/shared/ui/link";
import { getItemsWord } from "../lib/order-formatters";
import type { Order } from "../model";

export function OrderItemsPreview({
  items,
  onOpenDetails,
  className,
}: {
  items: Order["items"];
  onOpenDetails: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState<number | null>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      // Each cover is 60px wide, with an 8px gap. Reserve one slot only on overflow.
      setCapacity(Math.max(1, Math.floor((entry.contentRect.width + 8) / 68)));
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  const visibleCount =
    capacity === null || items.length <= capacity ? items.length : Math.max(0, capacity - 1);
  const remainingCount = items.length - visibleCount;

  return (
    <div ref={rowRef} className={cn("min-w-0", className)}>
      <div className="-m-1 flex gap-2 overflow-hidden p-1">
        {items.slice(0, visibleCount).map((item) => (
          <Link
            key={item.id}
            href={routes.product(item.categorySlug, item.slug)}
            className="relative h-20 w-15 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/5 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image
              fill
              src={item.image}
              alt={item.title}
              unoptimized={shouldBypassNextImageOptimization(item.image)}
              sizes="60px"
              className="object-cover"
            />
          </Link>
        ))}
        {remainingCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="h-20 w-15 shrink-0 bg-muted/60 px-1 text-muted-foreground"
            aria-haspopup="dialog"
            aria-label={`Ещё ${remainingCount} ${getItemsWord(remainingCount)} — посмотреть весь заказ`}
            onClick={onOpenDetails}
          >
            +{remainingCount}
          </Button>
        )}
      </div>
    </div>
  );
}
