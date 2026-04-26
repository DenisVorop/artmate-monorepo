"use client";

import type { OzonDeliveryPointInfoDTO } from "@/shared/actions/ozon";
import { cn } from "@/shared/lib";
import { Badge } from "@/shared/ui";

import { formatMoney, getDeliveryPointKindLabel, getDeliveryPointStatusLabel } from "../lib";

type PickupPointOptionProps = {
  point: OzonDeliveryPointInfoDTO;
  selected: boolean;
  onSelect: () => void;
};

export function PickupPointOption({ point, selected, onSelect }: PickupPointOptionProps) {
  return (
    <button
      type="button"
      disabled={!point.available}
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border bg-background p-3 text-left transition",
        selected
          ? "border-rose-300 bg-rose-50/70 ring-2 ring-rose-200/70"
          : "hover:border-rose-200 hover:bg-muted/40",
        !point.available && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{point.name}</span>
            <Badge variant={point.available ? "secondary" : "destructive"}>
              {getDeliveryPointStatusLabel(point)}
            </Badge>
          </span>
          <span className="block text-sm text-muted-foreground">{point.address}</span>
          <span className="block text-xs text-muted-foreground">{point.work_hours}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold">{formatMoney(point.delivery_price)}</span>
      </span>

      <span className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">{getDeliveryPointKindLabel(point)}</Badge>
        <Badge variant="outline">{point.delivery_term_days} дн.</Badge>
        <Badge variant="outline">до {point.restrictions.max_weight_g / 1000} кг</Badge>
      </span>

      {point.restrictions.unavailable_reason && (
        <span className="mt-2 block text-xs text-destructive">
          {point.restrictions.unavailable_reason}
        </span>
      )}
    </button>
  );
}
