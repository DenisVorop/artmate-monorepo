"use client";

import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  LoaderCircle,
  MapPin,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DeliveryCityDTO, DeliveryPickupPointDTO } from "@/shared/actions/delivery";
import type { CreateOrderDeliveryInputDTO } from "@/shared/actions/orders";
import { cn } from "@/shared/lib";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui";

import { useCdekCities, useCdekPickupPoints } from "../../model";

import { PickupPointsMap } from "./pickup-points-map";

type DeliverySelectorProps = {
  onChange: (_delivery: CreateOrderDeliveryInputDTO | undefined) => void;
  selectedDelivery?: CreateOrderDeliveryInputDTO;
};

export function DeliverySelector({ onChange, selectedDelivery }: DeliverySelectorProps) {
  const [cityQuery, setCityQuery] = useState("");
  const [pickupPointQuery, setPickupPointQuery] = useState("");
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isPickupPointOpen, setIsPickupPointOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<DeliveryCityDTO>();
  const { cities, isPending: areCitiesPending } = useCdekCities(cityQuery);
  const { isPending: arePickupPointsPending, pickupPoints } = useCdekPickupPoints(
    selectedCity?.code,
  );
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
        <CardTitle>Доставка СДЭК</CardTitle>
        <CardDescription>Выберите город и пункт выдачи для расчета стоимости.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(18rem,1.05fr)]">
          <div className="space-y-4">
            <ComboboxField
              emptyText={
                cityQuery.trim().length < 2 ? "Введите минимум 2 символа" : "Город не найден"
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
              placeholder="Москва"
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
              disabled={!selectedCity || arePickupPointsPending}
              emptyText={
                selectedCity
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

            {selectedPickupPoint ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-rose-500" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">Выбран пункт выдачи</p>
                    <p className="text-muted-foreground">{selectedPickupPoint.address}</p>
                    <p className="text-xs text-muted-foreground">{selectedPickupPoint.workHours}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {selectedCity ? (
            arePickupPointsPending ? (
              <MapPlaceholder icon={<LoaderCircle className="size-4 animate-spin" />}>
                Загружаем пункты выдачи
              </MapPlaceholder>
            ) : (
              <PickupPointsMap
                onSelect={selectPickupPoint}
                pickupPoints={pickupPoints}
                selectedPickupPointId={selectedPickupPoint?.id}
              />
            )
          ) : (
            <MapPlaceholder icon={<MapPin className="size-4" />}>
              Выберите город, чтобы увидеть пункты выдачи на карте
            </MapPlaceholder>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MapPlaceholder({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-lg border bg-muted/30 px-4 text-center text-sm text-muted-foreground md:min-h-96">
      <div className="flex max-w-72 flex-col items-center justify-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
          {icon}
        </span>
        <span>{children}</span>
      </div>
    </div>
  );
}

type ComboboxFieldProps = {
  children: ReactNode;
  disabled?: boolean;
  emptyText: string;
  inputValue: string;
  isOpen: boolean;
  isPending: boolean;
  label: string;
  onInputChange: (_value: string) => void;
  onOpenChange: (_isOpen: boolean) => void;
  placeholder: string;
  selectedLabel?: string;
  triggerLabel: string;
};

function ComboboxField({
  children,
  disabled = false,
  emptyText,
  inputValue,
  isOpen,
  isPending,
  label,
  onInputChange,
  onOpenChange,
  placeholder,
  selectedLabel,
  triggerLabel,
}: ComboboxFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasOptions = Array.isArray(children) ? children.length > 0 : Boolean(children);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={isOpen} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            role="combobox"
            aria-expanded={isOpen}
            className={cn(
              "h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal whitespace-normal",
              !selectedLabel && "text-muted-foreground",
            )}
          >
            <span className="line-clamp-2 min-w-0">{triggerLabel}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder={placeholder}
                className="pl-9"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-1">
            {isPending ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Загружаем
              </div>
            ) : hasOptions ? (
              children
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

type ComboboxOptionProps = {
  description?: string;
  icon?: ReactNode;
  isSelected: boolean;
  label: string;
  meta?: string;
  onSelect: () => void;
};

function ComboboxOption({
  description,
  icon,
  isSelected,
  label,
  meta,
  onSelect,
}: ComboboxOptionProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted",
        isSelected && "bg-rose-50 text-rose-950",
      )}
      onClick={onSelect}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block font-medium">{label}</span>
        {meta ? <span className="block text-xs text-muted-foreground">{meta}</span> : null}
        {description ? (
          <span className="block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {isSelected ? <Check className="mt-0.5 size-4 shrink-0 text-rose-500" /> : null}
    </button>
  );
}

function filterPickupPoints(points: DeliveryPickupPointDTO[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  if (!normalizedQuery) {
    return points;
  }

  return points.filter((point) =>
    [point.title, point.address, point.workHours]
      .join(" ")
      .toLocaleLowerCase("ru-RU")
      .includes(normalizedQuery),
  );
}
