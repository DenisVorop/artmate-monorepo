"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  DeliveryCityDTO,
  DeliveryPickupPointDTO,
  OzonDeliveryCityDTO,
} from "@/shared/actions/delivery";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui/button";

import {
  clearCdekDraftCity,
  clearOzonDraftCity,
  filterPickupPoints,
  formatPickupPointCount,
  selectDraftCity,
  selectDraftPickupPoint,
  selectOzonDraftCity,
  useDebouncedCityQuery,
  type DeliveryPickerDrafts,
} from "../../lib";
import {
  useCdekCities,
  useCdekPickupPoints,
  useOzonCities,
  useOzonPickupPoints,
} from "../../model";

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
  const ozonCityQuery = useDebouncedCityQuery(selectedCompany === "ozon" ? cityQuery : "");
  const selectedCity = drafts.cdek.city;
  const cdekCityCode = drafts.cdek.cityCode;
  const selectedOzonCity = drafts.ozon.city;
  const ozonLocalityId = drafts.ozon.localityId;
  const {
    cities: cdekCities,
    isError: areCdekCitiesError,
    isPending: areCdekCitiesPending,
  } = useCdekCities(selectedCompany === "cdek" ? cityQuery : "");
  const {
    cities: ozonCities,
    isError: areOzonCitiesError,
    isPending: areOzonCitiesPending,
    isFetching: areOzonCitiesFetching,
    retry: retryOzonCities,
  } = useOzonCities(
    ozonCityQuery,
    selectedCompany === "ozon" && ozonCityQuery === cityQuery.trim(),
  );
  const {
    isError: areCdekPickupPointsError,
    isPending: areCdekPickupPointsPending,
    pickupPoints: cdekPickupPoints,
  } = useCdekPickupPoints(cdekCityCode);
  const ozonPickupPoints = useOzonPickupPoints(
    selectedCompany === "ozon" && isOzonDeliveryAvailable && ozonLocalityId
      ? ozonLocalityId
      : undefined,
  );
  const selectedCdekPoint =
    drafts.cdek.pickupPoint ??
    cdekPickupPoints.find((point) => point.id === drafts.cdek.pickupPointId);
  const filteredCdekPickupPoints = useMemo(
    () => filterPickupPoints(cdekPickupPoints, pickupPointQuery),
    [cdekPickupPoints, pickupPointQuery],
  );
  const selectedOzonPoint = ozonLocalityId
    ? ozonPickupPoints.pickupPoints.find((point) => point.id === drafts.ozon.pickupPointId)
    : undefined;
  const visibleOzonPoints = useMemo(
    () => filterPickupPoints(ozonPickupPoints.pickupPoints, pickupPointQuery),
    [ozonPickupPoints.pickupPoints, pickupPointQuery],
  );
  const ozonStatusMessage = !ozonLocalityId
    ? "Сначала выберите город, чтобы увидеть доступные ПВЗ."
    : ozonPickupPoints.isError
      ? "Не удалось загрузить ПВЗ. Попробуйте ещё раз."
      : ozonPickupPoints.isPending
        ? "Загружаем ПВЗ выбранного города."
        : ozonPickupPoints.pickupPoints.length > 0
          ? `Нашли ${formatPickupPointCount(ozonPickupPoints.pickupPoints.length)}. Выберите адрес в списке или на карте.`
          : "Для этого города пункты выдачи пока не найдены.";

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

  const selectOzonCity = (city: OzonDeliveryCityDTO) => {
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
    if (!ozonLocalityId || !ozonPickupPoints.pickupPoints.some(({ id }) => id === point.id)) {
      return;
    }

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
                areCdekCitiesError
                  ? "Не удалось загрузить города"
                  : cityQuery.trim().length < 2
                    ? "Введите минимум 2 символа"
                    : "Город не найден"
              }
              inputValue={cityQuery}
              isOpen={isCityOpen}
              isPending={areCdekCitiesPending}
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
              {cdekCities.map((city) => (
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
                areOzonCitiesError
                  ? "Не удалось загрузить города"
                  : cityQuery.trim().length < 2
                    ? "Введите минимум 2 символа"
                    : "Город не найден"
              }
              inputValue={cityQuery}
              isOpen={isCityOpen}
              isPending={
                areOzonCitiesPending ||
                (cityQuery.trim().length >= 2 && ozonCityQuery !== cityQuery.trim())
              }
              label="Город"
              onInputChange={(value) => {
                setCityQuery(value);
                setPickupPointQuery("");
                setIsPickupPointOpen(false);
                onDraftChange(clearOzonDraftCity);
              }}
              onOpenChange={setIsCityOpen}
              placeholder="Начните вводить город"
              selectedLabel={
                selectedOzonCity?.name ?? (ozonLocalityId ? "Город выбран" : undefined)
              }
              triggerLabel={
                selectedOzonCity?.name ?? (ozonLocalityId ? "Город выбран" : "Выберите город")
              }
            >
              {ozonCities.map((city) => (
                <ComboboxOption
                  key={city.id}
                  icon={<MapPin className="size-4 text-muted-foreground" />}
                  isSelected={selectedOzonCity?.id === city.id}
                  label={city.name}
                  meta={city.region}
                  onSelect={() => selectOzonCity(city)}
                />
              ))}
            </ComboboxField>

            {areOzonCitiesError ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={areOzonCitiesFetching}
                onClick={() => void retryOzonCities()}
              >
                {areOzonCitiesFetching ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {areOzonCitiesFetching ? "Загружаем города" : "Повторить поиск города"}
              </Button>
            ) : null}

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
              disabled={!ozonLocalityId || ozonPickupPoints.isPending || ozonPickupPoints.isError}
              emptyText={
                !ozonLocalityId
                  ? "Сначала выберите город"
                  : ozonPickupPoints.isError
                    ? "Не удалось загрузить ПВЗ"
                    : pickupPointQuery
                      ? "ПВЗ не найден"
                      : "Пункты выдачи не найдены"
              }
              inputValue={pickupPointQuery}
              isOpen={isPickupPointOpen}
              isPending={ozonPickupPoints.isPending}
              label="Пункт выдачи Ozon"
              onInputChange={setPickupPointQuery}
              onOpenChange={setIsPickupPointOpen}
              placeholder="Адрес или название ПВЗ"
              selectedLabel={ozonLocalityId ? selectedOzonPoint?.address : undefined}
              triggerLabel={
                ozonLocalityId
                  ? (selectedOzonPoint?.address ?? "Выберите пункт выдачи")
                  : "Сначала выберите город"
              }
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

            {ozonPickupPoints.isError ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ozonPickupPoints.isFetching}
                onClick={() => void ozonPickupPoints.retry()}
              >
                {ozonPickupPoints.isFetching ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {ozonPickupPoints.isFetching ? "Загружаем ПВЗ" : "Повторить загрузку ПВЗ"}
              </Button>
            ) : null}

            {selectedOzonPoint ? <SelectedPickupPoint point={selectedOzonPoint} /> : null}
          </div>

          {ozonLocalityId ? (
            ozonPickupPoints.isError ? (
              <MapPlaceholder
                compact
                icon={<CircleAlert className="size-4" />}
                title="ПВЗ Ozon не загрузились"
              >
                Повторите загрузку или выберите другой город.
              </MapPlaceholder>
            ) : ozonPickupPoints.isPending ? (
              <MapPlaceholder
                icon={<LoaderCircle className="size-4 animate-spin" />}
                title="Загружаем пункты выдачи"
              >
                Карта появится после загрузки всех ПВЗ Ozon выбранного города.
              </MapPlaceholder>
            ) : ozonPickupPoints.pickupPoints.length === 0 ? (
              <MapPlaceholder compact icon={<MapPin className="size-4" />} title="ПВЗ не найдены">
                Выберите другой город или повторите загрузку позже.
              </MapPlaceholder>
            ) : (
              <PickupPointsMap
                key="ozon-pickup-points-map"
                ariaLabel="Карта пунктов выдачи Ozon"
                onSelect={selectOzonPickupPoint}
                pickupPoints={ozonPickupPoints.pickupPoints}
                selectedPickupPointId={selectedOzonPoint?.id}
              />
            )
          ) : (
            <MapPlaceholder compact icon={<MapPin className="size-4" />} title="Начните с города">
              После выбора города покажем доступные ПВЗ и карту рядом со списком.
            </MapPlaceholder>
          )}
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
