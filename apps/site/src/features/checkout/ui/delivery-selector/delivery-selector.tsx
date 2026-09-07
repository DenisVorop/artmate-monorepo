"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { DeliveryCityDTO, DeliveryPickupPointDTO } from "@/shared/actions/delivery";
import { cn } from "@/shared/lib";

import {
  clearCdekDraftCity,
  clearOzonDraftCity,
  filterPickupPoints,
  formatPickupPointCount,
  getOzonDraftInitialView,
  getOzonLocatorMapFocus,
  selectDraftCity,
  selectDraftPickupPoint,
  selectOzonDraftCity,
  setOzonDraftMapRequest,
  type DeliveryPickerDrafts,
} from "../../lib";
import { useCdekCities, useCdekPickupPoints, useOzonPickupPoints } from "../../model";

import { ComboboxField } from "./combobox-field";
import { ComboboxOption } from "./combobox-option";
import { DeliveryCompanySelector } from "./delivery-company-selector";
import { defaultDeliveryCompany, type DeliveryCompanyCode } from "./delivery-options";
import { MapPlaceholder } from "./map-placeholder";
import { PickupPointsMap } from "./pickup-points-map";

type DeliverySelectorProps = {
  drafts: DeliveryPickerDrafts;
  isOzonDeliveryAvailable: boolean;
  onCompanyChange: (_company: DeliveryCompanyCode) => void;
  onDraftChange: (_update: (_drafts: DeliveryPickerDrafts) => DeliveryPickerDrafts) => void;
  selectedCompany?: DeliveryCompanyCode;
};

export function DeliverySelector({
  drafts,
  isOzonDeliveryAvailable,
  onCompanyChange,
  onDraftChange,
  selectedCompany = defaultDeliveryCompany,
}: DeliverySelectorProps) {
  const [cityQuery, setCityQuery] = useState("");
  const [pickupPointQuery, setPickupPointQuery] = useState("");
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isPickupPointOpen, setIsPickupPointOpen] = useState(false);
  const [ozonInitialView, setOzonInitialView] = useState(() =>
    getOzonDraftInitialView(drafts.ozon),
  );
  const selectedCity = drafts.cdek.city;
  const cdekCityCode = drafts.cdek.cityCode;
  const selectedOzonCity = drafts.ozon.city;
  const ozonCityCode = drafts.ozon.cityCode;
  const selectedOzonPoint = drafts.ozon.pickupPoint;
  const ozonMapRequest = drafts.ozon.mapRequest;
  const { cities, isError: areCitiesError, isPending: areCitiesPending } = useCdekCities(cityQuery);
  const {
    isError: areCdekPickupPointsError,
    isPending: areCdekPickupPointsPending,
    pickupPoints: cdekPickupPoints,
  } = useCdekPickupPoints(cdekCityCode);
  const {
    isError: areOzonLocatorPointsError,
    isPending: areOzonLocatorPointsPending,
    pickupPoints: ozonLocatorPoints,
    resolvedCityCode: ozonLocatorCityCode,
  } = useCdekPickupPoints(ozonCityCode);
  const ozonPickupPoints = useOzonPickupPoints(
    selectedCompany === "ozon" && isOzonDeliveryAvailable ? ozonMapRequest : undefined,
  );
  const selectedCdekPoint =
    drafts.cdek.pickupPoint ??
    cdekPickupPoints.find((point) => point.id === drafts.cdek.pickupPointId);
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
  const ozonMapFocus = useMemo(
    () => getOzonLocatorMapFocus(ozonCityCode, ozonLocatorCityCode, ozonLocatorPoints),
    [ozonCityCode, ozonLocatorCityCode, ozonLocatorPoints],
  );
  const ozonLocatorStatusMessage = !ozonCityCode
    ? "Выберите город, чтобы переместить карту, или найдите область вручную."
    : areOzonLocatorPointsError
      ? "Не удалось автоматически определить область города. Переместите карту вручную."
      : areOzonLocatorPointsPending
        ? "Определяем область выбранного города."
        : ozonMapFocus
          ? "Карта перемещена к выбранному городу."
          : "Не удалось автоматически определить область города. Переместите карту вручную.";
  const ozonPickupPointsStatusMessage = ozonPickupPoints.isError
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
  const ozonStatusMessage = ozonMapRequest
    ? ozonPickupPointsStatusMessage
    : ozonLocatorStatusMessage;

  useEffect(() => {
    if (isOzonDeliveryAvailable || selectedCompany !== "ozon") {
      return;
    }

    onCompanyChange("cdek");
  }, [isOzonDeliveryAvailable, onCompanyChange, selectedCompany]);

  const selectCompany = (company: DeliveryCompanyCode) => {
    if (company === selectedCompany || (company === "ozon" && !isOzonDeliveryAvailable)) {
      return;
    }

    if (company === "ozon") setOzonInitialView(getOzonDraftInitialView(drafts.ozon));
    onCompanyChange(company);
    setCityQuery("");
    setPickupPointQuery("");
    setIsCityOpen(false);
    setIsPickupPointOpen(false);
  };

  const selectCdekCity = (city: DeliveryCityDTO) => {
    setCityQuery(city.name);
    setIsCityOpen(false);
    setPickupPointQuery("");
    setIsPickupPointOpen(false);
    onDraftChange((current) => selectDraftCity(current, city));
  };

  const selectOzonCity = (city: DeliveryCityDTO) => {
    setCityQuery(city.name);
    setIsCityOpen(false);
    setPickupPointQuery("");
    setIsPickupPointOpen(false);
    onDraftChange((current) => selectOzonDraftCity(current, city));
  };

  const selectCdekPickupPoint = (point: DeliveryPickupPointDTO) => {
    if (!cdekCityCode) {
      return;
    }

    setPickupPointQuery("");
    setIsPickupPointOpen(false);
    onDraftChange((current) => selectDraftPickupPoint(current, "cdek", point));
  };

  const selectOzonPickupPoint = (point: DeliveryPickupPointDTO) => {
    setPickupPointQuery("");
    setIsPickupPointOpen(false);
    onDraftChange((current) => selectDraftPickupPoint(current, "ozon", point));
  };

  return (
    <div className="space-y-5">
      <DeliveryCompanySelector
        isOzonDeliveryAvailable={isOzonDeliveryAvailable}
        selectedCompany={selectedCompany}
        onSelect={selectCompany}
      />

      {selectedCompany === "cdek" ? (
        <div
          className={cn(
            "grid gap-5",
            cdekCityCode
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
                setPickupPointQuery("");
                setIsPickupPointOpen(false);
                onDraftChange(clearCdekDraftCity);
              }}
              onOpenChange={setIsCityOpen}
              placeholder="Начните вводить город"
              selectedLabel={selectedCity?.name ?? (cdekCityCode ? "Город выбран" : undefined)}
              triggerLabel={
                selectedCity?.name ?? (cdekCityCode ? "Город выбран" : "Выберите город")
              }
            >
              {cities.map((city) => (
                <ComboboxOption
                  key={city.code}
                  icon={<MapPin className="size-4 text-muted-foreground" />}
                  isSelected={selectedCity?.code === city.code}
                  label={city.name}
                  onSelect={() => selectCdekCity(city)}
                />
              ))}
            </ComboboxField>

            <ComboboxField
              disabled={!cdekCityCode || areCdekPickupPointsPending || areCdekPickupPointsError}
              emptyText={
                areCdekPickupPointsError
                  ? "Не удалось загрузить ПВЗ"
                  : cdekCityCode
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
                  : cdekCityCode
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

            {cdekCityCode && !areCdekPickupPointsPending && !areCdekPickupPointsError ? (
              <p className="text-sm text-muted-foreground">
                {cdekPickupPoints.length > 0
                  ? `Нашли ${formatPickupPointCount(cdekPickupPoints.length)}. Выберите адрес в списке или на карте.`
                  : "Для этого города пункты выдачи пока не найдены."}
              </p>
            ) : null}

            {selectedCdekPoint ? <SelectedPickupPoint point={selectedCdekPoint} /> : null}
          </div>

          {cdekCityCode ? (
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
                key="cdek-pickup-points-map"
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
                setPickupPointQuery("");
                setIsPickupPointOpen(false);
                onDraftChange(clearOzonDraftCity);
              }}
              onOpenChange={setIsCityOpen}
              placeholder="Начните вводить город"
              selectedLabel={selectedOzonCity?.name ?? (ozonCityCode ? "Город выбран" : undefined)}
              triggerLabel={
                selectedOzonCity?.name ?? (ozonCityCode ? "Город выбран" : "Выберите город")
              }
            >
              {cities.map((city) => (
                <ComboboxOption
                  key={city.code}
                  icon={<MapPin className="size-4 text-muted-foreground" />}
                  isSelected={selectedOzonCity?.code === city.code}
                  label={city.name}
                  onSelect={() => selectOzonCity(city)}
                />
              ))}
            </ComboboxField>

            <p
              role="status"
              aria-atomic={true}
              aria-live="polite"
              className="h-5 min-w-0 truncate text-sm leading-5 text-muted-foreground"
              title={ozonStatusMessage}
            >
              {ozonStatusMessage}
            </p>

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

            {selectedOzonPoint ? <SelectedPickupPoint point={selectedOzonPoint} /> : null}
          </div>

          <PickupPointsMap
            key="ozon-pickup-points-map"
            aggregateClusters={ozonPickupPoints.aggregateClusters}
            ariaLabel="Карта пунктов выдачи Ozon"
            emptyMessage="Передвиньте карту, чтобы найти пункт выдачи Ozon."
            fitPoints={false}
            focus={ozonMapFocus}
            initialCenter={ozonInitialView.center}
            initialZoom={ozonInitialView.zoom}
            onSelect={selectOzonPickupPoint}
            onViewportChange={(request) =>
              onDraftChange((current) => setOzonDraftMapRequest(current, request))
            }
            pickupPoints={visibleOzonPoints}
            selectedPickupPointId={selectedOzonPoint?.id}
          />
        </div>
      )}
    </div>
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
