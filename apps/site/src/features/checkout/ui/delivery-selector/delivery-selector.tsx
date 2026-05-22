"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, MapPin, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import type { DeliveryCityDTO, DeliveryPickupPointDTO } from "@/shared/actions/delivery";
import type { CreateOrderDeliveryInputDTO } from "@/shared/actions/orders";
import { cn } from "@/shared/lib";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

import { filterPickupPoints, formatPickupPointCount } from "../../lib";
import { useCdekCities, useCdekPickupPoints } from "../../model";

import { ComboboxField } from "./combobox-field";
import { ComboboxOption } from "./combobox-option";
import { DeliveryCompanySelector } from "./delivery-company-selector";
import { defaultDeliveryCompany, type DeliveryCompanyCode } from "./delivery-options";
import { MapPlaceholder } from "./map-placeholder";
import { PickupPointsMap } from "./pickup-points-map";

type DeliverySelectorProps = {
  onChange: (_delivery: CreateOrderDeliveryInputDTO | undefined) => void;
  selectedDelivery?: CreateOrderDeliveryInputDTO;
};

export function DeliverySelector({ onChange, selectedDelivery }: DeliverySelectorProps) {
  const [selectedCompany, setSelectedCompany] = useState<DeliveryCompanyCode | undefined>(
    selectedDelivery?.provider === "cdek" ? "cdek" : defaultDeliveryCompany,
  );
  const [cityQuery, setCityQuery] = useState("");
  const [pickupPointQuery, setPickupPointQuery] = useState("");
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isPickupPointOpen, setIsPickupPointOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<DeliveryCityDTO>();
  const { cities, isError: areCitiesError, isPending: areCitiesPending } = useCdekCities(cityQuery);
  const {
    isError: arePickupPointsError,
    isPending: arePickupPointsPending,
    pickupPoints,
  } = useCdekPickupPoints(selectedCity?.code);
  const selectedPickupPoint = pickupPoints.find(
    (point) => point.id === selectedDelivery?.pickupPointId,
  );
  const filteredPickupPoints = useMemo(
    () => filterPickupPoints(pickupPoints, pickupPointQuery),
    [pickupPointQuery, pickupPoints],
  );

  const resetDelivery = () => {
    setPickupPointQuery("");
    onChange(undefined);
  };

  const selectCompany = (company: DeliveryCompanyCode) => {
    if (company === selectedCompany) {
      return;
    }

    setSelectedCompany(company);
    setCityQuery("");
    setPickupPointQuery("");
    setSelectedCity(undefined);
    setIsCityOpen(false);
    setIsPickupPointOpen(false);
    onChange(undefined);
  };

  const selectCity = (city: DeliveryCityDTO) => {
    setSelectedCity(city);
    setCityQuery(city.name);
    setIsCityOpen(false);
    resetDelivery();
  };

  const selectPickupPoint = (point: DeliveryPickupPointDTO) => {
    if (!selectedCity) {
      return;
    }

    setPickupPointQuery("");
    setIsPickupPointOpen(false);
    onChange({
      cityCode: selectedCity.code,
      pickupPointId: point.id,
      provider: "cdek",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Доставка</CardTitle>
        <CardDescription>
          Выберите город и пункт выдачи, чтобы мы рассчитали стоимость в итогах заказа.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <DeliveryCompanySelector selectedCompany={selectedCompany} onSelect={selectCompany} />

        {selectedCompany === "cdek" ? (
          <div
            className={cn(
              "grid gap-5",
              selectedCity
                ? "md:grid-cols-[minmax(0,0.95fr)_minmax(18rem,1.05fr)]"
                : "md:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]",
            )}
          >
            <div className="space-y-4">
              <ComboboxField
                emptyText={
                  areCitiesError
                    ? "Не удалось загрузить города"
                    : cityQuery.trim().length < 2
                      ? "Введите минимум 2 символа"
                      : "Город не найден"
                }
                inputValue={cityQuery}
                isOpen={isCityOpen}
                isPending={areCitiesPending}
                label="Город"
                onInputChange={(value) => {
                  setCityQuery(value);
                  setSelectedCity(undefined);
                  resetDelivery();
                }}
                onOpenChange={setIsCityOpen}
                placeholder="Начните вводить город"
                selectedLabel={selectedCity?.name}
                triggerLabel={selectedCity?.name ?? "Выберите город"}
              >
                {cities.map((city) => (
                  <ComboboxOption
                    key={city.code}
                    icon={<MapPin className="size-4 text-muted-foreground" />}
                    isSelected={selectedCity?.code === city.code}
                    label={city.name}
                    onSelect={() => selectCity(city)}
                  />
                ))}
              </ComboboxField>

              <ComboboxField
                disabled={!selectedCity || arePickupPointsPending || arePickupPointsError}
                emptyText={
                  arePickupPointsError
                    ? "Не удалось загрузить ПВЗ"
                    : selectedCity
                      ? pickupPointQuery
                        ? "ПВЗ не найден"
                        : "Пункты выдачи не найдены"
                      : "Сначала выберите город"
                }
                inputValue={pickupPointQuery}
                isOpen={isPickupPointOpen}
                isPending={arePickupPointsPending}
                label="Пункт выдачи"
                onInputChange={setPickupPointQuery}
                onOpenChange={setIsPickupPointOpen}
                placeholder="Адрес или название ПВЗ"
                selectedLabel={selectedPickupPoint?.address}
                triggerLabel={
                  selectedPickupPoint
                    ? selectedPickupPoint.address
                    : selectedCity
                      ? "Выберите пункт выдачи"
                      : "Сначала выберите город"
                }
              >
                {filteredPickupPoints.slice(0, 80).map((point) => (
                  <ComboboxOption
                    key={point.id}
                    description={point.workHours}
                    icon={<MapPin className="size-4 text-muted-foreground" />}
                    isSelected={selectedPickupPoint?.id === point.id}
                    label={point.address}
                    meta={point.title}
                    onSelect={() => selectPickupPoint(point)}
                  />
                ))}
              </ComboboxField>

              {selectedCity && !arePickupPointsPending && !arePickupPointsError ? (
                <p className="text-sm text-muted-foreground">
                  {pickupPoints.length > 0
                    ? `Нашли ${formatPickupPointCount(pickupPoints.length)}. Выберите адрес в списке или на карте.`
                    : "Для этого города пункты выдачи пока не найдены."}
                </p>
              ) : null}

              {selectedPickupPoint ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">Выбран пункт выдачи</p>
                      <p className="text-muted-foreground">{selectedPickupPoint.address}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedPickupPoint.workHours}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {selectedCity ? (
              arePickupPointsError ? (
                <MapPlaceholder
                  compact
                  icon={<CircleAlert className="size-4" />}
                  title="Пункты выдачи не загрузились"
                >
                  Попробуйте выбрать город заново или обновить страницу.
                </MapPlaceholder>
              ) : arePickupPointsPending ? (
                <MapPlaceholder
                  icon={<LoaderCircle className="size-4 animate-spin" />}
                  title="Загружаем пункты выдачи"
                >
                  Карта появится сразу после загрузки адресов СДЭК.
                </MapPlaceholder>
              ) : (
                <PickupPointsMap
                  onSelect={selectPickupPoint}
                  pickupPoints={pickupPoints}
                  selectedPickupPointId={selectedPickupPoint?.id}
                />
              )
            ) : (
              <MapPlaceholder compact icon={<MapPin className="size-4" />} title="Начните с города">
                После выбора города покажем доступные ПВЗ и карту рядом со списком.
              </MapPlaceholder>
            )}
          </div>
        ) : (
          <MapPlaceholder compact icon={<Truck className="size-4" />}>
            Выберите службу доставки, чтобы перейти к выбору пункта выдачи
          </MapPlaceholder>
        )}
      </CardContent>
    </Card>
  );
}
