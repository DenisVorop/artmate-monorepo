"use client";

import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { MapPin } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useState } from "react";

import type { DeliveryPickupPointDTO } from "@/shared/actions/delivery";

import {
  createPickupPointSearchIndex,
  getPickupPointNavigationIndex,
  includeActivePickupPoint,
  isPickupPointSelectionCurrent,
  searchPickupPointIndex,
} from "../../lib";

import { ComboboxField } from "./combobox-field";
import { ComboboxOption } from "./combobox-option";

type PickupPointComboboxProps = {
  datasetIdentity: string;
  disabled?: boolean;
  emptyText: string;
  isOpen: boolean;
  isPending: boolean;
  label: string;
  onOpenChange: (_isOpen: boolean) => void;
  onQueryChange: (_query: string) => void;
  onSelect: (_point: DeliveryPickupPointDTO) => void;
  pickupPoints: DeliveryPickupPointDTO[];
  placeholder: string;
  query: string;
  selectedPoint?: DeliveryPickupPointDTO;
  triggerLabel: string;
};

export function PickupPointCombobox({
  datasetIdentity,
  disabled = false,
  emptyText,
  isOpen,
  isPending,
  label,
  onOpenChange,
  onQueryChange,
  onSelect,
  pickupPoints,
  placeholder,
  query,
  selectedPoint,
  triggerLabel,
}: PickupPointComboboxProps) {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const listboxId = useId();
  const [activeOption, setActiveOption] = useState({
    datasetIdentity,
    index: -1,
    pickupPoints,
    query,
  });
  const searchInput = useMemo(
    () => ({ datasetIdentity, pickupPoints, query }),
    [datasetIdentity, pickupPoints, query],
  );
  const renderedSearchInput = useDeferredValue(searchInput);
  const searchIndex = useMemo(
    () => createPickupPointSearchIndex(renderedSearchInput.pickupPoints),
    [renderedSearchInput.pickupPoints],
  );
  const filteredPoints = useMemo(
    () => searchPickupPointIndex(searchIndex, renderedSearchInput.query),
    [renderedSearchInput.query, searchIndex],
  );
  const isCurrent = isPickupPointSelectionCurrent(
    query,
    renderedSearchInput.query,
    datasetIdentity,
    renderedSearchInput.datasetIdentity,
    query,
    datasetIdentity,
    pickupPoints,
    renderedSearchInput.pickupPoints,
  );
  const isActiveCurrent = isPickupPointSelectionCurrent(
    query,
    renderedSearchInput.query,
    datasetIdentity,
    renderedSearchInput.datasetIdentity,
    activeOption.query,
    activeOption.datasetIdentity,
    pickupPoints,
    renderedSearchInput.pickupPoints,
    activeOption.pickupPoints,
  );
  const activeIndex =
    isActiveCurrent && activeOption.index >= 0 && activeOption.index < filteredPoints.length
      ? activeOption.index
      : -1;
  const getItemKey = useCallback(
    (index: number) => filteredPoints[index]?.id ?? index,
    [filteredPoints],
  );
  const getScrollElement = useCallback(() => scrollElement, [scrollElement]);
  const rangeExtractor = useCallback(
    (range: Parameters<typeof defaultRangeExtractor>[0]) =>
      includeActivePickupPoint(defaultRangeExtractor(range), activeIndex, range.count),
    [activeIndex],
  );
  const virtualizer = useVirtualizer({
    count: filteredPoints.length,
    enabled: isOpen,
    estimateSize: () => 72,
    getItemKey,
    getScrollElement,
    overscan: 5,
    rangeExtractor,
    useFlushSync: false,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const activeDescendant =
    isCurrent && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    virtualizer.scrollToOffset(0);
  }, [renderedSearchInput.datasetIdentity, renderedSearchInput.query, virtualizer]);

  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      virtualizer.scrollToIndex(activeIndex, { align: "auto" });
    }
  }, [activeIndex, isOpen, virtualizer]);

  const selectPoint = (point: DeliveryPickupPointDTO) => {
    if (!isCurrent) return;
    onSelect(point);
  };

  return (
    <ComboboxField
      activeDescendant={activeDescendant}
      disabled={disabled}
      emptyText={emptyText}
      hasOptions={filteredPoints.length > 0}
      inputValue={query}
      isOpen={isOpen}
      isPending={isPending}
      label={label}
      listboxId={listboxId}
      listboxLabel={label}
      listRef={setScrollElement}
      onInputChange={(value) => {
        setActiveOption({ datasetIdentity, index: -1, pickupPoints, query: value });
        onQueryChange(value);
      }}
      onInputKeyDown={(event) => {
        if (!isOpen) return;

        if (event.key === "Escape") {
          event.preventDefault();
          onOpenChange(false);
          return;
        }

        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (!isCurrent) return;

        const isBoundaryKey =
          (event.key === "Home" || event.key === "End") && (event.ctrlKey || event.metaKey);
        const isArrowKey = event.key === "ArrowDown" || event.key === "ArrowUp";

        if (isArrowKey || isBoundaryKey) {
          event.preventDefault();
          setActiveOption({
            datasetIdentity: renderedSearchInput.datasetIdentity,
            index: getPickupPointNavigationIndex(
              activeIndex,
              event.key as "ArrowDown" | "ArrowUp" | "End" | "Home",
              filteredPoints.length,
            ),
            pickupPoints: renderedSearchInput.pickupPoints,
            query: renderedSearchInput.query,
          });
          return;
        }

        if (event.key === "Enter" && activeIndex >= 0) {
          const activePoint = filteredPoints[activeIndex];

          if (activePoint) {
            event.preventDefault();
            selectPoint(activePoint);
          }
        }
      }}
      onOpenChange={(open) => {
        if (!open) setActiveOption({ datasetIdentity, index: -1, pickupPoints, query });
        onOpenChange(open);
      }}
      placeholder={placeholder}
      selectedLabel={selectedPoint?.address}
      triggerLabel={triggerLabel}
    >
      {isOpen ? (
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualItems.map((virtualItem) => {
            const point = filteredPoints[virtualItem.index];

            if (!point) return null;

            return (
              <div
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                className="absolute top-0 left-0 w-full py-0.5"
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                <ComboboxOption
                  ariaPosInSet={virtualItem.index + 1}
                  ariaSetSize={filteredPoints.length}
                  id={`${listboxId}-option-${virtualItem.index}`}
                  role="option"
                  description={point.workHours}
                  icon={<MapPin className="size-4 text-muted-foreground" />}
                  isActive={activeIndex === virtualItem.index}
                  isSelected={selectedPoint?.id === point.id}
                  label={point.address}
                  meta={point.title}
                  onSelect={() => selectPoint(point)}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </ComboboxField>
  );
}
