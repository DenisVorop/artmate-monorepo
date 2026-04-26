"use client";

import { MapPin, Navigation } from "lucide-react";

import type {
  OzonDeliveryMapResponseDTO,
  OzonDeliveryPointInfoDTO,
  OzonDeliveryViewportDTO,
} from "@/shared/actions/ozon";
import { cn } from "@/shared/lib";

import { getCheckoutDeliveryCity, type CheckoutDeliveryCityId } from "../lib";

type DeliveryMapProps = {
  cityId: CheckoutDeliveryCityId;
  map?: OzonDeliveryMapResponseDTO;
  points: OzonDeliveryPointInfoDTO[];
  selectedPickupPointId: string;
  onPickupPointChange: (_pickupPointId: string) => void;
};

export function DeliveryMap({
  cityId,
  map,
  points,
  selectedPickupPointId,
  onPickupPointChange,
}: DeliveryMapProps) {
  const city = getCheckoutDeliveryCity(cityId);

  return (
    <div className="relative aspect-[4/3] min-h-80 overflow-hidden rounded-lg border bg-[linear-gradient(90deg,var(--muted)_1px,transparent_1px),linear-gradient(0deg,var(--muted)_1px,transparent_1px)] bg-[size:32px_32px]">
      <div className="absolute inset-0 bg-background/75" />
      <div className="absolute top-4 left-4 z-10 rounded-lg border bg-background/95 px-3 py-2 text-sm shadow-sm">
        <div className="flex items-center gap-2 font-medium">
          <Navigation className="size-4 text-rose-500" />
          {city.label}
        </div>
        <p className="text-xs text-muted-foreground">Пункты выдачи Ozon</p>
      </div>

      {map?.clusters.map((cluster) => {
        const position = getMapPosition(cluster.coordinate, city.request.viewport);

        return (
          <span
            key={cluster.cluster_id}
            className="absolute z-10 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-rose-200 bg-rose-100/80 text-xs font-semibold text-rose-700"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          >
            {cluster.count}
          </span>
        );
      })}

      {points.map((point) => {
        const selected = String(point.map_point_id) === selectedPickupPointId;
        const position = getMapPosition(point.coordinate, city.request.viewport);

        return (
          <button
            key={point.map_point_id}
            type="button"
            disabled={!point.available}
            title={`${point.name}, ${point.address}`}
            onClick={() => onPickupPointChange(String(point.map_point_id))}
            className={cn(
              "absolute z-20 flex size-9 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition",
              selected
                ? "border-rose-500 bg-rose-500 text-white ring-4 ring-rose-200"
                : "border-border hover:border-rose-300 hover:text-rose-600",
              !point.available && "cursor-not-allowed opacity-45",
            )}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          >
            <MapPin className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

function getMapPosition(
  coordinate: { lat: number; long: number },
  viewport: OzonDeliveryViewportDTO,
) {
  const minLat = Math.min(viewport.left_bottom.lat, viewport.right_top.lat);
  const maxLat = Math.max(viewport.left_bottom.lat, viewport.right_top.lat);
  const minLong = Math.min(viewport.left_bottom.long, viewport.right_top.long);
  const maxLong = Math.max(viewport.left_bottom.long, viewport.right_top.long);
  const x = ((coordinate.long - minLong) / (maxLong - minLong)) * 100;
  const y = 100 - ((coordinate.lat - minLat) / (maxLat - minLat)) * 100;

  return {
    x: clamp(x, 6, 94),
    y: clamp(y, 12, 92),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
