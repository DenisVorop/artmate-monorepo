"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import type { DeliveryCityDTO, DeliveryPickupPointDTO } from "@/shared/actions/delivery";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui/button";

import {
  clearCdekDraftCity,
  clearOzonDraftCity,
  formatPickupPointCount,
  selectDraftCity,
  selectDraftPickupPoint,
  selectOzonDraftCity,
  type DeliveryPickerDrafts,
} from "../../lib";
import { useCdekCity, useCdekCities, useCdekPickupPoints, useOzonPickupPoints } from "../../model";

import { ComboboxField } from "./combobox-field";
import { ComboboxOption } from "./combobox-option";
import { DeliveryCompanySelector } from "./delivery-company-selector";
import { defaultDeliveryCompany, type DeliveryCompanyCode } from "./delivery-options";
import { MapPlaceholder } from "./map-placeholder";
import { PickupPointCombobox } from "./pickup-point-combobox";
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
  const selectedCity = drafts.cdek.city;
  const cdekCityCode = drafts.cdek.cityCode;
  const selectedOzonCity = drafts.ozon.city;
  const ozonCityCode = drafts.ozon.cityCode;
  const {
    cities,
    isError: areCitiesError,
    isFetching: areCitiesFetching,
    isPending: areCitiesPending,
    retry: retryCities,
  } = useCdekCities(cityQuery);
  const ozonCityDetails = useCdekCity(ozonCityCode, selectedCompany === "ozon");
  const ozonPickupPointsState = useOzonPickupPoints(
    ozonCityCode,
    selectedCompany === "ozon" &&
      Boolean(ozonCityCode) &&
      ozonCityDetails.city?.code === ozonCityCode,
  );
  const {
    isError: areCdekPickupPointsError,
    isPending: areCdekPickupPointsPending,
    pickupPoints: cdekPickupPoints,
  } = useCdekPickupPoints(cdekCityCode);
  const selectedCdekPoint =
    drafts.cdek.pickupPoint ??
    cdekPickupPoints.find((point) => point.id === drafts.cdek.pickupPointId);
  const selectedOzonPoint =
    drafts.ozon.pickupPoint ??
    ozonPickupPointsState.pickupPoints.find((point) => point.id === drafts.ozon.pickupPointId);

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
    if (!ozonCityCode || ozonCityDetails.city?.code !== ozonCityCode) return;
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

            <PickupPointCombobox
              datasetIdentity={`cdek:${cdekCityCode ?? ""}`}
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
              isOpen={isPickupPointOpen}
              isPending={areCdekPickupPointsPending}
              label="Пункт выдачи"
              onOpenChange={setIsPickupPointOpen}
              onQueryChange={setPickupPointQuery}
              onSelect={selectCdekPickupPoint}
              pickupPoints={cdekPickupPoints}
              placeholder="Адрес или название ПВЗ"
              query={pickupPointQuery}
              selectedPoint={selectedCdekPoint}
              triggerLabel={
                selectedCdekPoint
                  ? selectedCdekPoint.address
                  : cdekCityCode
                    ? "Выберите пункт выдачи"
                    : "Сначала выберите город"
              }
            />

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

            {areCitiesError ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={areCitiesFetching}
                onClick={() => void retryCities()}
              >
                {areCitiesFetching ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {areCitiesFetching ? "Загружаем города" : "Повторить поиск города"}
              </Button>
            ) : null}

            <PickupPointCombobox
              datasetIdentity={`ozon:${ozonCityCode ?? ""}`}
              disabled={!ozonCityCode || !ozonCityDetails.city || !ozonPickupPointsState.hasData}
              emptyText={
                ozonPickupPointsState.isError
                  ? "Не удалось загрузить ПВЗ Ozon"
                  : !ozonCityCode
                    ? "Сначала выберите город"
                    : pickupPointQuery
                      ? "ПВЗ не найден"
                      : "Пункты выдачи не найдены"
              }
              isOpen={isPickupPointOpen}
              isPending={ozonPickupPointsState.isPending}
              label="Пункт выдачи Ozon"
              onOpenChange={setIsPickupPointOpen}
              onQueryChange={setPickupPointQuery}
              onSelect={selectOzonPickupPoint}
              pickupPoints={ozonPickupPointsState.pickupPoints}
              placeholder="Адрес или название ПВЗ"
              query={pickupPointQuery}
              selectedPoint={selectedOzonPoint}
              triggerLabel={
                selectedOzonPoint
                  ? selectedOzonPoint.address
                  : ozonCityCode
                    ? "Выберите пункт выдачи"
                    : "Сначала выберите город"
              }
            />

            {ozonPickupPointsState.hasData && ozonPickupPointsState.pickupPoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Для этого города пункты Ozon не найдены.
              </p>
            ) : null}

            {ozonPickupPointsState.isFetching ? (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
                {ozonPickupPointsState.hasData
                  ? "Обновляем пункты Ozon. Уже загруженные пункты доступны для выбора."
                  : "Загружаем пункты Ozon для выбранного города."}
              </p>
            ) : null}

            {ozonPickupPointsState.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {ozonPickupPointsState.errorMessage ??
                  "Не удалось загрузить пункты Ozon. Попробуйте ещё раз."}
              </p>
            ) : null}

            {ozonPickupPointsState.isError ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ozonPickupPointsState.isFetching}
                onClick={() => void ozonPickupPointsState.retry()}
              >
                {ozonPickupPointsState.isFetching ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {ozonPickupPointsState.isFetching ? "Загружаем ПВЗ" : "Повторить загрузку ПВЗ"}
              </Button>
            ) : null}

            {selectedOzonPoint ? <SelectedPickupPoint point={selectedOzonPoint} /> : null}

            {ozonCityDetails.isError ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ozonCityDetails.isFetching}
                onClick={() => void ozonCityDetails.retry()}
              >
                {ozonCityDetails.isFetching ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {ozonCityDetails.isFetching ? "Загружаем город" : "Повторить загрузку города"}
              </Button>
            ) : null}
          </div>

          {ozonCityCode ? (
            ozonCityDetails.isError && !ozonCityDetails.city ? (
              <MapPlaceholder
                compact
                icon={<CircleAlert className="size-4" />}
                title="Пункты Ozon не загрузились"
              >
                Повторите загрузку или выберите другой город.
              </MapPlaceholder>
            ) : !ozonCityDetails.city && ozonCityDetails.isPending ? (
              <MapPlaceholder
                icon={<LoaderCircle className="size-4 animate-spin" />}
                title="Находим город на карте"
              >
                После этого загрузим пункты выдачи Ozon.
              </MapPlaceholder>
            ) : ozonCityDetails.city ? (
              <PickupPointsMap
                key={`ozon-city-map-${ozonCityCode}`}
                ariaLabel={`Карта города ${ozonCityDetails.city.name}`}
                fitPoints={false}
                initialCenter={{
                  lat: ozonCityDetails.city.latitude,
                  long: ozonCityDetails.city.longitude,
                }}
                initialZoom={12}
                onSelect={selectOzonPickupPoint}
                pickupPoints={ozonPickupPointsState.pickupPoints}
                selectedPickupPointId={selectedOzonPoint?.id}
              />
            ) : null
          ) : (
            <MapPlaceholder compact icon={<MapPin className="size-4" />} title="Начните с города">
              После выбора города покажем его на карте.
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
