"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  DeliveryCityDTO,
  DeliveryPickupPointDTO,
  OzonDeliveryMapRequestDTO,
} from "@/shared/actions/delivery";
import type { CreateOrderDeliveryInputDTO } from "@/shared/actions/orders";
import { cn } from "@/shared/lib";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";

import { filterPickupPoints, formatPickupPointCount } from "../../lib";
import { useCdekCities, useCdekPickupPoints, useOzonPickupPoints } from "../../model";

import { ComboboxField } from "./combobox-field";
import { ComboboxOption } from "./combobox-option";
import { DeliveryCompanySelector } from "./delivery-company-selector";
import { defaultDeliveryCompany, type DeliveryCompanyCode } from "./delivery-options";
import { MapPlaceholder } from "./map-placeholder";
import { PickupPointsMap } from "./pickup-points-map";

type DeliverySelectorProps = {
  isOzonDeliveryAvailable: boolean;
  onChange: (_delivery: CreateOrderDeliveryInputDTO | undefined) => void;
  selectedDelivery?: CreateOrderDeliveryInputDTO;
};

export function DeliverySelector({
  isOzonDeliveryAvailable,
  onChange,
  selectedDelivery,
}: DeliverySelectorProps) {
  const [selectedCompany, setSelectedCompany] = useState<DeliveryCompanyCode>(() =>
    selectedDelivery?.provider === "ozon" && isOzonDeliveryAvailable
      ? "ozon"
      : defaultDeliveryCompany,
  );
  const [cityQuery, setCityQuery] = useState("");
  const [pickupPointQuery, setPickupPointQuery] = useState("");
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isPickupPointOpen, setIsPickupPointOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<DeliveryCityDTO>();
  const [selectedOzonPoint, setSelectedOzonPoint] = useState<DeliveryPickupPointDTO>();
  const [ozonMapRequest, setOzonMapRequest] = useState<OzonDeliveryMapRequestDTO>();
  const { cities, isError: areCitiesError, isPending: areCitiesPending } = useCdekCities(cityQuery);
  const {
    isError: areCdekPickupPointsError,
    isPending: areCdekPickupPointsPending,
    pickupPoints: cdekPickupPoints,
  } = useCdekPickupPoints(selectedCity?.code);
  const ozonPickupPoints = useOzonPickupPoints(
    selectedCompany === "ozon" && isOzonDeliveryAvailable ? ozonMapRequest : undefined,
  );
  const selectedCdekPoint =
    selectedDelivery?.provider === "cdek"
      ? cdekPickupPoints.find((point) => point.id === selectedDelivery.pickupPointId)
      : undefined;
  const filteredCdekPickupPoints = useMemo(
    () => filterPickupPoints(cdekPickupPoints, pickupPointQuery),
    [cdekPickupPoints, pickupPointQuery],
  );
  const visibleOzonPoints = useMemo(() => {
    const points = selectedOzonPoint
      ? [
          selectedOzonPoint,
          ...ozonPickupPoints.pickupPoints.filter((point) => point.id !== selectedOzonPoint.id),
        ]
      : ozonPickupPoints.pickupPoints;

    return filterPickupPoints(points, pickupPointQuery);
  }, [ozonPickupPoints.pickupPoints, pickupPointQuery, selectedOzonPoint]);
  const ozonStatusMessage = ozonPickupPoints.isError
    ? "Не удалось загрузить ПВЗ. Попробуйте позже."
    : ozonPickupPoints.isPending
      ? "Загружаем ПВЗ на карте."
      : ozonPickupPoints.pickupPoints.length > 0 && ozonPickupPoints.aggregateClusters.length > 0
        ? `Доступно ${formatPickupPointCount(ozonPickupPoints.pickupPoints.length)} и группы ПВЗ.`
        : ozonPickupPoints.pickupPoints.length > 0
          ? `В области ${formatPickupPointCount(ozonPickupPoints.pickupPoints.length)}.`
          : ozonPickupPoints.aggregateClusters.length > 0
            ? "На карте есть группы ПВЗ - приблизьте их."
            : "ПВЗ не найдены - измените область карты.";

  useEffect(() => {
    const hasUnavailableOzonSelection =
      selectedCompany === "ozon" || selectedDelivery?.provider === "ozon";

    if (isOzonDeliveryAvailable || !hasUnavailableOzonSelection) {
      return;
    }

    setSelectedCompany("cdek");
    setSelectedOzonPoint(undefined);
    setOzonMapRequest(undefined);
    setPickupPointQuery("");
    setIsPickupPointOpen(false);
    onChange(undefined);
  }, [isOzonDeliveryAvailable, onChange, selectedCompany, selectedDelivery?.provider]);

  const resetDelivery = () => {
    setPickupPointQuery("");
    setSelectedOzonPoint(undefined);
    onChange(undefined);
  };

  const selectCompany = (company: DeliveryCompanyCode) => {
    if (company === selectedCompany || (company === "ozon" && !isOzonDeliveryAvailable)) {
      return;
    }

    setSelectedCompany(company);
    setCityQuery("");
    setPickupPointQuery("");
    setSelectedCity(undefined);
    setSelectedOzonPoint(undefined);
    setOzonMapRequest(undefined);
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

  const selectCdekPickupPoint = (point: DeliveryPickupPointDTO) => {
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

  const selectOzonPickupPoint = (point: DeliveryPickupPointDTO) => {
    setSelectedOzonPoint(point);
    setPickupPointQuery("");
    setIsPickupPointOpen(false);
    onChange({
      provider: "ozon",
      pickupPointId: point.id,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Доставка</CardTitle>
        <CardDescription>
          Сначала выберите службу доставки, затем пункт выдачи на карте.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <DeliveryCompanySelector
          isOzonDeliveryAvailable={isOzonDeliveryAvailable}
          selectedCompany={selectedCompany}
          onSelect={selectCompany}
        />

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
                disabled={!selectedCity || areCdekPickupPointsPending || areCdekPickupPointsError}
                emptyText={
                  areCdekPickupPointsError
                    ? "Не удалось загрузить ПВЗ"
                    : selectedCity
                      ? pickupPointQuery
                        ? "ПВЗ не найден"
                        : "Пункты выдачи не найдены"
                      : "Сначала выберите город"
                }
                inputValue={pickupPointQuery}
                isOpen={isPickupPointOpen}
                isPending={areCdekPickupPointsPending}
                label="Пункт выдачи"
                onInputChange={setPickupPointQuery}
                onOpenChange={setIsPickupPointOpen}
                placeholder="Адрес или название ПВЗ"
                selectedLabel={selectedCdekPoint?.address}
                triggerLabel={
                  selectedCdekPoint
                    ? selectedCdekPoint.address
                    : selectedCity
                      ? "Выберите пункт выдачи"
                      : "Сначала выберите город"
                }
              >
                {filteredCdekPickupPoints.slice(0, 80).map((point) => (
                  <ComboboxOption
                    key={point.id}
                    description={point.workHours}
                    icon={<MapPin className="size-4 text-muted-foreground" />}
                    isSelected={selectedCdekPoint?.id === point.id}
                    label={point.address}
                    meta={point.title}
                    onSelect={() => selectCdekPickupPoint(point)}
                  />
                ))}
              </ComboboxField>

              {selectedCity && !areCdekPickupPointsPending && !areCdekPickupPointsError ? (
                <p className="text-sm text-muted-foreground">
                  {cdekPickupPoints.length > 0
                    ? `Нашли ${formatPickupPointCount(cdekPickupPoints.length)}. Выберите адрес в списке или на карте.`
                    : "Для этого города пункты выдачи пока не найдены."}
                </p>
              ) : null}

              {selectedCdekPoint ? <SelectedPickupPoint point={selectedCdekPoint} /> : null}
            </div>

            {selectedCity ? (
              areCdekPickupPointsError ? (
                <MapPlaceholder
                  compact
                  icon={<CircleAlert className="size-4" />}
                  title="Пункты выдачи не загрузились"
                >
                  Попробуйте выбрать город заново или обновить страницу.
                </MapPlaceholder>
              ) : areCdekPickupPointsPending ? (
                <MapPlaceholder
                  icon={<LoaderCircle className="size-4 animate-spin" />}
                  title="Загружаем пункты выдачи"
                >
                  Карта появится сразу после загрузки адресов СДЭК.
                </MapPlaceholder>
              ) : (
                <PickupPointsMap
                  ariaLabel="Карта пунктов выдачи СДЭК"
                  onSelect={selectCdekPickupPoint}
                  pickupPoints={cdekPickupPoints}
                  selectedPickupPointId={selectedCdekPoint?.id}
                />
              )
            ) : (
              <MapPlaceholder compact icon={<MapPin className="size-4" />} title="Начните с города">
                После выбора города покажем доступные ПВЗ и карту рядом со списком.
              </MapPlaceholder>
            )}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(18rem,1.05fr)]">
            <div className="min-w-0 space-y-4">
              <ComboboxField
                disabled={ozonPickupPoints.isPending || ozonPickupPoints.isError}
                emptyText={
                  ozonPickupPoints.isError
                    ? "Не удалось загрузить ПВЗ"
                    : pickupPointQuery
                      ? ozonPickupPoints.aggregateClusters.length > 0
                        ? "Среди раскрытых точек ПВЗ не найден - приблизьте область или раскройте кластер"
                        : "ПВЗ не найден"
                      : ozonPickupPoints.aggregateClusters.length > 0
                        ? "Приблизьте группу точек на карте, чтобы увидеть ПВЗ"
                        : "Передвиньте карту, чтобы найти ПВЗ"
                }
                inputValue={pickupPointQuery}
                isOpen={isPickupPointOpen}
                isPending={ozonPickupPoints.isPending}
                label="Пункт выдачи Ozon"
                onInputChange={setPickupPointQuery}
                onOpenChange={setIsPickupPointOpen}
                placeholder="Адрес или название ПВЗ"
                selectedLabel={selectedOzonPoint?.address}
                triggerLabel={selectedOzonPoint?.address ?? "Выберите пункт выдачи"}
              >
                {visibleOzonPoints.map((point) => (
                  <ComboboxOption
                    key={point.id}
                    description={point.workHours}
                    icon={<MapPin className="size-4 text-muted-foreground" />}
                    isSelected={selectedOzonPoint?.id === point.id}
                    label={point.address}
                    meta={point.title}
                    onSelect={() => selectOzonPickupPoint(point)}
                  />
                ))}
              </ComboboxField>

              <p
                aria-live="polite"
                className="h-5 min-w-0 truncate text-sm leading-5 text-muted-foreground"
                title={ozonStatusMessage}
              >
                {ozonStatusMessage}
              </p>

              {selectedOzonPoint ? <SelectedPickupPoint point={selectedOzonPoint} /> : null}
            </div>

            <PickupPointsMap
              aggregateClusters={ozonPickupPoints.aggregateClusters}
              ariaLabel="Карта пунктов выдачи Ozon"
              emptyMessage="Передвиньте карту, чтобы найти пункт выдачи Ozon."
              fitPoints={false}
              initialCenter={{ lat: 55.75, long: 37.62 }}
              initialZoom={11}
              onSelect={selectOzonPickupPoint}
              onViewportChange={setOzonMapRequest}
              pickupPoints={visibleOzonPoints}
              selectedPickupPointId={selectedOzonPoint?.id}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SelectedPickupPoint({ point }: { point: DeliveryPickupPointDTO }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div className="min-w-0 space-y-1">
          <p className="font-medium">Выбран пункт выдачи</p>
          <p className="text-muted-foreground">{point.address}</p>
          <p className="text-xs text-muted-foreground">{point.workHours}</p>
        </div>
      </div>
    </div>
  );
}
