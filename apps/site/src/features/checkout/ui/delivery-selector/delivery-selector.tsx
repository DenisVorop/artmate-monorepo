"use client";

import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  CircleAlert,
  LoaderCircle,
  MapPin,
  Package,
  Store,
  Search,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DeliveryCityDTO, DeliveryPickupPointDTO } from "@/shared/actions/delivery";
import type { CreateOrderDeliveryInputDTO } from "@/shared/actions/orders";
import { cn } from "@/shared/lib";
import {
  Badge,
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

type DeliveryCompanyCode = "cdek" | "ozon" | "wildberries";

const deliveryCompanies: Array<{
  accentClassName: string;
  code: DeliveryCompanyCode;
  icon: LucideIcon;
  isEnabled: boolean;
  label: string;
}> = [
  {
    accentClassName: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    code: "cdek",
    icon: Truck,
    isEnabled: true,
    label: "СДЭК",
  },
  {
    accentClassName: "bg-blue-50 text-blue-700 ring-blue-200",
    code: "ozon",
    icon: Package,
    isEnabled: false,
    label: "Ozon",
  },
  {
    accentClassName: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
    code: "wildberries",
    icon: Store,
    isEnabled: false,
    label: "Wildberries",
  },
];

const defaultDeliveryCompany = deliveryCompanies.find((company) => company.isEnabled)?.code;

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

type DeliveryCompanySelectorProps = {
  onSelect: (_company: DeliveryCompanyCode) => void;
  selectedCompany?: DeliveryCompanyCode;
};

function DeliveryCompanySelector({ onSelect, selectedCompany }: DeliveryCompanySelectorProps) {
  const enabledCompanies = deliveryCompanies.filter((company) => company.isEnabled);
  const upcomingCompanies = deliveryCompanies.filter((company) => !company.isEnabled);

  return (
    <div className="space-y-2">
      <Label>Служба доставки</Label>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.85fr)]">
        <div className={cn("grid gap-2", enabledCompanies.length > 1 && "sm:grid-cols-2")}>
          {enabledCompanies.map((company) => {
            const isSelected = selectedCompany === company.code;
            const Icon = company.icon;

            return (
              <button
                key={company.code}
                type="button"
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors outline-none",
                  "hover:border-rose-200 hover:bg-rose-50/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected && "border-rose-500 bg-rose-50 text-rose-950 shadow-sm",
                )}
                onClick={() => onSelect(company.code)}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1",
                    company.accentClassName,
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{company.label}</span>
                  <span className="block text-xs text-muted-foreground">Пункты выдачи по РФ</span>
                </span>
                {isSelected ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-rose-500" />
                ) : null}
              </button>
            );
          })}
        </div>

        {upcomingCompanies.length > 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Скоро подключим</p>
              <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[11px]">
                Неактивно
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {upcomingCompanies.map((company) => {
                const Icon = company.icon;

                return (
                  <span
                    key={company.code}
                    className="inline-flex items-center gap-2 rounded-md bg-background px-2.5 py-1.5 text-sm text-muted-foreground ring-1 ring-border"
                  >
                    <Icon className="size-4" />
                    {company.label}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MapPlaceholder({
  children,
  compact = false,
  icon,
  title,
}: {
  children: ReactNode;
  compact?: boolean;
  icon: ReactNode;
  title?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-52 items-center justify-center rounded-lg border bg-muted/30 px-4 text-center text-sm text-muted-foreground",
        !compact && "min-h-72 md:min-h-96",
      )}
    >
      <div className="flex max-w-80 flex-col items-center justify-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
          {icon}
        </span>
        {title ? <span className="font-medium text-foreground">{title}</span> : null}
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
        "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:bg-muted",
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

function formatPickupPointCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} пункт`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} пункта`;
  }

  return `${count} пунктов`;
}
