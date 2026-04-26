"use client";

import { LoaderCircle, RotateCw } from "lucide-react";

import type { OzonDeliveryMapResponseDTO, OzonDeliveryPointInfoDTO } from "@/shared/actions/ozon";
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
  getCheckoutDeliveryCity,
  getDeliveryPointKindLabel,
  type CheckoutDeliveryCityId,
} from "../lib";

import { DeliveryMap } from "./delivery-map";
import { PickupPointOption } from "./pickup-point-option";
import { PickupPointSkeleton } from "./pickup-point-skeleton";

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
