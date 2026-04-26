"use client";

import { LoaderCircle, MapPin, Navigation, RotateCw } from "lucide-react";

import type {
  OzonDeliveryMapResponseDTO,
  OzonDeliveryPointInfoDTO,
  OzonDeliveryViewportDTO,
} from "@/shared/actions/ozon";
import { cn } from "@/shared/lib";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataState,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/shared/ui";

import {
  checkoutDeliveryCities,
  formatMoney,
  getCheckoutDeliveryCity,
  getDeliveryPointKindLabel,
  getDeliveryPointStatusLabel,
  type CheckoutDeliveryCityId,
} from "../lib";

type PickupPointSelectorProps = {
  cityId: CheckoutDeliveryCityId;
  map?: OzonDeliveryMapResponseDTO;
  points: OzonDeliveryPointInfoDTO[];
  selectedPickupPointId: string;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  onCityChange: (_cityId: CheckoutDeliveryCityId) => void;
  onPickupPointChange: (_pickupPointId: string) => void;
  onRetry: () => void;
};

export function PickupPointSelector({
  cityId,
  map,
  points,
  selectedPickupPointId,
  isPending,
  isFetching,
  isError,
  error,
  onCityChange,
  onPickupPointChange,
  onRetry,
}: PickupPointSelectorProps) {
  const city = getCheckoutDeliveryCity(cityId);
  const availablePoints = points.filter((point) => point.available);
  const selectedPoint = points.find(
    (point) => String(point.map_point_id) === selectedPickupPointId,
  );

  return (
    <Card>
      <CardHeader className="gap-4">
        <div>
          <CardTitle>Доставка Ozon Pickup</CardTitle>
          <CardDescription>Выберите город и пункт выдачи для расчета доставки.</CardDescription>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={cityId}
            onValueChange={(value) => onCityChange(value as CheckoutDeliveryCityId)}
          >
            <TabsList>
              {checkoutDeliveryCities.map((deliveryCity) => (
                <TabsTrigger key={deliveryCity.id} value={deliveryCity.id}>
                  {deliveryCity.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isFetching && !isPending && <LoaderCircle className="size-3.5 animate-spin" />}
            <span>{availablePoints.length} доступных точек</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isPending && <PickupPointSkeleton />}

        {!isPending && isError && (
          <div className="space-y-4">
            <DataState
              variant="error"
              title="Не удалось загрузить ПВЗ"
              description={error?.message ?? "Проверьте API и попробуйте еще раз."}
              className="max-w-none"
            />
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={onRetry}>
                <RotateCw data-icon="inline-start" />
                Повторить
              </Button>
            </div>
          </div>
        )}

        {!isPending && !isError && points.length === 0 && (
          <DataState
            title="В этой зоне нет ПВЗ"
            description="Выберите другой город или попробуйте обновить список позднее."
            className="max-w-none"
          />
        )}

        {!isPending && !isError && points.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <DeliveryMap
              cityId={cityId}
              map={map}
              points={points}
              selectedPickupPointId={selectedPickupPointId}
              onPickupPointChange={onPickupPointChange}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Пункты выдачи</p>
                  <p className="text-xs text-muted-foreground">{city.label}</p>
                </div>
                {selectedPoint && (
                  <Badge variant="secondary">{getDeliveryPointKindLabel(selectedPoint)}</Badge>
                )}
              </div>

              <div className="max-h-[31rem] space-y-2 overflow-y-auto pr-1">
                {points.map((point) => (
                  <PickupPointOption
                    key={point.map_point_id}
                    point={point}
                    selected={String(point.map_point_id) === selectedPickupPointId}
                    onSelect={() => onPickupPointChange(String(point.map_point_id))}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type DeliveryMapProps = {
  cityId: CheckoutDeliveryCityId;
  map?: OzonDeliveryMapResponseDTO;
  points: OzonDeliveryPointInfoDTO[];
  selectedPickupPointId: string;
  onPickupPointChange: (_pickupPointId: string) => void;
};

function DeliveryMap({
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
      <div className="absolute left-4 top-4 z-10 rounded-lg border bg-background/95 px-3 py-2 text-sm shadow-sm">
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

type PickupPointOptionProps = {
  point: OzonDeliveryPointInfoDTO;
  selected: boolean;
  onSelect: () => void;
};

function PickupPointOption({ point, selected, onSelect }: PickupPointOptionProps) {
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

function PickupPointSkeleton() {
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
