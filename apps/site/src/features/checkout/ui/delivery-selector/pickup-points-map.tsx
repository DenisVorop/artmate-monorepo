"use client";

import type { LatLngBounds, LatLngBoundsExpression, LayerGroup, Map as LeafletMap } from "leaflet";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  DeliveryPickupPointDTO,
  OzonDeliveryMapClusterDTO,
  OzonDeliveryMapRequestDTO,
} from "@/shared/actions/delivery";
import { cn } from "@/shared/lib";

import styles from "./pickup-points-map.module.css";

type LeafletModule = typeof import("leaflet");
type MapBounds = Pick<LatLngBounds, "getEast" | "getNorth" | "getSouth" | "getWest">;
type MarkerActivationSource = "keyboard" | "pointer";
type PendingMarkerFocusRef = { current: string | undefined };

const mapMaxZoom = 19;
const mapMinZoom = 2;
const worldBounds: LatLngBoundsExpression = [
  [-90, -180],
  [90, 180],
];

type PickupPointsMapProps = {
  aggregateClusters?: OzonDeliveryMapClusterDTO[];
  ariaLabel?: string;
  emptyMessage?: string;
  fitPoints?: boolean;
  initialCenter?: { lat: number; long: number };
  initialZoom?: number;
  onSelect: (_point: DeliveryPickupPointDTO) => void;
  onViewportChange?: (_request: OzonDeliveryMapRequestDTO) => void;
  pickupPoints: DeliveryPickupPointDTO[];
  selectedPickupPointId?: string;
};

type GeoPickupPoint = DeliveryPickupPointDTO & {
  latitude: number;
  longitude: number;
};

export function PickupPointsMap({
  aggregateClusters = [],
  ariaLabel = "Карта пунктов выдачи",
  emptyMessage = "Для выбранного города служба доставки не вернула координаты ПВЗ. Выберите пункт выдачи из списка.",
  fitPoints = true,
  initialCenter,
  initialZoom = 12,
  onSelect,
  onViewportChange,
  pickupPoints,
  selectedPickupPointId,
}: PickupPointsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const onViewportChangeRef = useRef(onViewportChange);
  const pendingFocusPickupPointIdRef = useRef<string | undefined>(undefined);
  const previousSelectedPickupPointIdRef = useRef<string | undefined>(undefined);
  const [leaflet, setLeaflet] = useState<LeafletModule>();
  const geoPoints = useMemo(() => pickupPoints.filter(isGeoPickupPoint), [pickupPoints]);
  const selectedPoint = geoPoints.find((point) => point.id === selectedPickupPointId);
  const initialPoint = geoPoints[0];
  const initialCoordinate = getInitialMapCoordinate(initialCenter, initialPoint);
  const initialLatitude = initialCoordinate?.lat;
  const initialLongitude = initialCoordinate?.long;

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    let isMounted = true;

    void import("leaflet").then((module) => {
      if (isMounted) {
        setLeaflet(module);
      }
    });

    return () => {
      isMounted = false;
      pendingFocusPickupPointIdRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (
      !leaflet ||
      !containerRef.current ||
      initialLatitude === undefined ||
      initialLongitude === undefined ||
      mapRef.current
    ) {
      return;
    }

    let isActive = true;
    const map = leaflet.map(containerRef.current, {
      attributionControl: false,
      maxBounds: worldBounds,
      maxBoundsViscosity: 1,
      maxZoom: mapMaxZoom,
      minZoom: mapMinZoom,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    leaflet.control.attribution({ prefix: false }).addTo(map);

    leaflet
      .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        // Public OSM tiles require visible attribution and are meant for reasonable traffic.
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: mapMaxZoom,
        noWrap: true,
      })
      .addTo(map);

    markersRef.current = leaflet.layerGroup().addTo(map);
    mapRef.current = map;
    const emitViewport = () => {
      if (!isActive) {
        return;
      }

      onViewportChangeRef.current?.(getOzonMapRequest(map.getBounds(), map.getZoom()));
    };

    map.setView([initialLatitude, initialLongitude], initialZoom);
    map.whenReady(() => {
      if (!isActive) {
        return;
      }

      map.on("moveend", emitViewport);
      emitViewport();
    });

    return () => {
      isActive = false;
      map.off("moveend", emitViewport);
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, [initialLatitude, initialLongitude, initialZoom, leaflet]);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markersRef.current;

    if (!leaflet || !map || !markerLayer) {
      restorePendingMarkerFocus(pendingFocusPickupPointIdRef, selectedPickupPointId, null);
      return;
    }

    markerLayer.clearLayers();

    if (geoPoints.length === 0 && aggregateClusters.length === 0) {
      restorePendingMarkerFocus(pendingFocusPickupPointIdRef, selectedPickupPointId, null);
      return;
    }

    const bounds: Array<[number, number]> = [];
    const markerActivationCleanups: Array<() => void> = [];
    let selectedMarkerElement: HTMLElement | null = null;

    geoPoints.forEach((point) => {
      const isSelected = point.id === selectedPickupPointId;
      const marker = leaflet.marker([point.latitude, point.longitude], {
        icon: leaflet.divIcon({
          className: styles.markerShell,
          html: `<span class="${cn(styles.marker, isSelected && styles.markerSelected)}"></span>`,
          iconAnchor: isSelected ? [12, 12] : [9, 9],
          iconSize: isSelected ? [24, 24] : [18, 18],
        }),
        title: point.title,
      });
      const tooltipContent = document.createElement("span");

      tooltipContent.textContent = point.address;

      marker.bindTooltip(tooltipContent, {
        direction: "top",
        offset: [0, -10],
      });
      marker.addTo(markerLayer);
      selectedMarkerElement = isSelected ? (marker.getElement() ?? null) : selectedMarkerElement;
      markerActivationCleanups.push(
        bindMarkerActivation(
          marker,
          point.title,
          () => onSelect(point),
          (source) => {
            pendingFocusPickupPointIdRef.current =
              source === "keyboard" && point.id !== selectedPickupPointId ? point.id : undefined;
          },
        ),
      );
      bounds.push([point.latitude, point.longitude]);
    });

    aggregateClusters.forEach((cluster) => {
      const viewport = cluster.viewport;

      if (!viewport) {
        return;
      }

      const markerAriaLabel = `Приблизить область: ${cluster.pointsCount} точек Ozon`;
      const marker = leaflet.marker([cluster.coordinate.lat, cluster.coordinate.long], {
        icon: leaflet.divIcon({
          className: styles.markerShell,
          html: `<span class="${styles.clusterMarker}">${cluster.pointsCount}</span>`,
          iconAnchor: [20, 20],
          iconSize: [40, 40],
        }),
        title: markerAriaLabel,
      });
      const tooltipContent = document.createElement("span");
      const activate = () => zoomToAggregateCluster(map, leaflet, viewport);

      tooltipContent.textContent = `${cluster.pointsCount} точек Ozon - нажмите, чтобы приблизить`;
      marker.bindTooltip(tooltipContent, {
        direction: "top",
        offset: [0, -20],
      });
      marker.addTo(markerLayer);
      markerActivationCleanups.push(bindMarkerActivation(marker, markerAriaLabel, activate));
    });

    restorePendingMarkerFocus(
      pendingFocusPickupPointIdRef,
      selectedPickupPointId,
      selectedMarkerElement,
    );

    const cleanupMarkerActivations = () => {
      markerActivationCleanups.forEach((cleanup) => cleanup());
    };

    if (selectedPickupPointId || !fitPoints || bounds.length === 0) {
      return cleanupMarkerActivations;
    }

    if (bounds.length === 1) {
      const [singlePoint] = bounds;

      if (singlePoint) {
        map.setView(singlePoint, 13);
      }

      return cleanupMarkerActivations;
    }

    map.fitBounds(bounds as LatLngBoundsExpression, {
      maxZoom: 13,
      padding: [24, 24],
    });

    return cleanupMarkerActivations;
  }, [aggregateClusters, fitPoints, geoPoints, leaflet, onSelect, selectedPickupPointId]);

  useEffect(() => {
    if (selectedPickupPointId === previousSelectedPickupPointIdRef.current) {
      return;
    }

    if (!selectedPickupPointId) {
      previousSelectedPickupPointIdRef.current = undefined;
      return;
    }

    const map = mapRef.current;

    if (!map || !selectedPoint) {
      return;
    }

    previousSelectedPickupPointIdRef.current = selectedPickupPointId;
    map.setView([selectedPoint.latitude, selectedPoint.longitude], 15, {
      animate: true,
    });
  }, [leaflet, selectedPickupPointId, selectedPoint]);

  if (!initialCoordinate) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
        <span className="max-w-72">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className={cn(styles.root, "relative overflow-hidden rounded-lg border bg-muted/30")}>
      <div
        ref={containerRef}
        role="region"
        aria-busy={!leaflet}
        aria-label={ariaLabel}
        className={cn("h-72 w-full md:h-96", !leaflet && "grid place-items-center")}
      >
        {!leaflet ? (
          <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin aria-hidden="true" className="size-4" />
            Загружаем карту
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isGeoPickupPoint(point: DeliveryPickupPointDTO): point is GeoPickupPoint {
  return (
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude)
  );
}

function zoomToAggregateCluster(
  map: Pick<LeafletMap, "getBoundsZoom" | "getZoom" | "setView">,
  leaflet: Pick<LeafletModule, "latLngBounds" | "point">,
  viewport: NonNullable<OzonDeliveryMapClusterDTO["viewport"]>,
) {
  const { leftBottom, rightTop } = viewport;
  const bounds = leaflet.latLngBounds([
    [leftBottom.lat, leftBottom.long],
    [rightTop.lat, rightTop.long],
  ]);
  const boundsZoom = map.getBoundsZoom(bounds, false, leaflet.point(24, 24));
  const targetZoom = Math.min(mapMaxZoom, Math.max(boundsZoom, map.getZoom() + 1));

  map.setView(bounds.getCenter(), targetZoom, { animate: false });
}

function bindMarkerActivation(
  marker: Pick<import("leaflet").Marker, "getElement" | "off" | "on">,
  ariaLabel: string,
  onActivate: () => void,
  onBeforeActivate?: (_source: MarkerActivationSource) => void,
) {
  const handleClick = () => {
    onBeforeActivate?.("pointer");
    onActivate();
  };

  marker.on("click", handleClick);

  const element = marker.getElement();

  if (!element) {
    return () => marker.off("click", handleClick);
  }

  element.setAttribute("aria-label", ariaLabel);
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
    }

    onBeforeActivate?.("keyboard");
    onActivate();
  };

  element.addEventListener("keydown", handleKeyDown);

  return () => {
    marker.off("click", handleClick);
    element.removeEventListener("keydown", handleKeyDown);
  };
}

function restorePendingMarkerFocus(
  pendingFocus: PendingMarkerFocusRef,
  selectedPickupPointId: string | undefined,
  selectedMarkerElement: Pick<HTMLElement, "focus"> | null,
) {
  const pendingFocusPickupPointId = pendingFocus.current;

  pendingFocus.current = undefined;

  if (pendingFocusPickupPointId !== selectedPickupPointId || !selectedMarkerElement) {
    return;
  }

  selectedMarkerElement.focus({ preventScroll: true });
}

function getInitialMapCoordinate(
  initialCenter: { lat: number; long: number } | undefined,
  initialPoint: Pick<GeoPickupPoint, "latitude" | "longitude"> | undefined,
) {
  return (
    initialCenter ??
    (initialPoint ? { lat: initialPoint.latitude, long: initialPoint.longitude } : undefined)
  );
}

function getOzonMapRequest(bounds: MapBounds, zoom: number): OzonDeliveryMapRequestDTO {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  return {
    viewport: {
      leftBottom: {
        lat: clamp(bounds.getSouth(), -90, 90),
        long: clamp(bounds.getWest(), -180, 180),
      },
      rightTop: {
        lat: clamp(bounds.getNorth(), -90, 90),
        long: clamp(bounds.getEast(), -180, 180),
      },
    },
    zoom: clamp(Math.round(zoom), mapMinZoom, mapMaxZoom),
  };
}
