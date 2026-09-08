"use client";

import type { LatLngBoundsExpression, LayerGroup, Map as LeafletMap } from "leaflet";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DeliveryPickupPointDTO } from "@/shared/actions/delivery";
import { cn } from "@/shared/lib";

import { clusterPickupPoints, getPickupPointsFitKey } from "../../lib";

import styles from "./pickup-points-map.module.css";

type LeafletModule = typeof import("leaflet");
type MarkerActivationSource = "keyboard" | "pointer";
type PendingMarkerFocusRef = { current: string | undefined };
type PreviousFitKeyRef = { current: string | undefined };

const mapMaxZoom = 19;
const mapMinZoom = 2;
const worldBounds: LatLngBoundsExpression = [
  [-90, -180],
  [90, 180],
];

type PickupPointsMapProps = {
  ariaLabel?: string;
  emptyMessage?: string;
  fitPoints?: boolean;
  initialCenter?: { lat: number; long: number };
  initialZoom?: number;
  onSelect: (_point: DeliveryPickupPointDTO) => void;
  pickupPoints: DeliveryPickupPointDTO[];
  selectedPickupPointId?: string;
};

type GeoPickupPoint = DeliveryPickupPointDTO & {
  latitude: number;
  longitude: number;
};

export function PickupPointsMap({
  ariaLabel = "Карта пунктов выдачи",
  emptyMessage = "Для выбранного города служба доставки не вернула координаты ПВЗ. Выберите пункт выдачи из списка.",
  fitPoints = true,
  initialCenter,
  initialZoom = 12,
  onSelect,
  pickupPoints,
  selectedPickupPointId,
}: PickupPointsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const pendingFocusPickupPointIdRef = useRef<string | undefined>(undefined);
  const previousFitKeyRef = useRef<string | undefined>(undefined);
  const previousSelectedPickupPointIdRef = useRef<string | undefined>(undefined);
  const [leaflet, setLeaflet] = useState<LeafletModule>();
  const [mapZoom, setMapZoom] = useState(initialZoom);
  const geoPoints = useMemo(() => pickupPoints.filter(isGeoPickupPoint), [pickupPoints]);
  const pointClusters = useMemo(
    () => clusterPickupPoints(geoPoints, mapZoom),
    [geoPoints, mapZoom],
  );
  const selectedPoint = geoPoints.find((point) => point.id === selectedPickupPointId);
  const initialPoint = geoPoints[0];
  const initialCoordinate = getInitialMapCoordinate(initialCenter, initialPoint);
  const initialLatitude = initialCoordinate?.lat;
  const initialLongitude = initialCoordinate?.long;
  const geoPointsFitKey = useMemo(
    () => getPickupPointsFitKey(fitPoints, initialLatitude, initialLongitude, geoPoints),
    [fitPoints, geoPoints, initialLatitude, initialLongitude],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

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
      scrollWheelZoom: true,
      touchZoom: true,
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
    const updateZoom = () => setMapZoom(map.getZoom());

    map.setView([initialLatitude, initialLongitude], initialZoom);
    map.whenReady(() => {
      if (!isActive) {
        return;
      }

      map.on("zoomend", updateZoom);
      updateZoom();
    });

    return () => {
      isActive = false;
      map.off("zoomend", updateZoom);
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

    if (pointClusters.length === 0) {
      restorePendingMarkerFocus(pendingFocusPickupPointIdRef, selectedPickupPointId, null);
      return;
    }

    const markerActivationCleanups: Array<() => void> = [];
    let selectedMarkerElement: HTMLElement | null = null;

    pointClusters.forEach((cluster) => {
      if (cluster.points.length > 1) {
        const markerAriaLabel = `${cluster.points.length} пунктов выдачи - приблизить`;
        const marker = leaflet.marker([cluster.latitude, cluster.longitude], {
          icon: leaflet.divIcon({
            className: styles.markerShell,
            html: `<span class="${styles.clusterMarker}">${cluster.points.length}</span>`,
            iconAnchor: [22, 22],
            iconSize: [44, 44],
          }),
          title: markerAriaLabel,
        });

        marker.addTo(markerLayer);
        markerActivationCleanups.push(
          bindMarkerActivation(marker, markerAriaLabel, () => {
            map.setView(
              [cluster.latitude, cluster.longitude],
              Math.min(mapMaxZoom, map.getZoom() + 2),
              { animate: false },
            );
          }),
        );
        return;
      }

      const point = cluster.points[0];

      if (!point) return;

      const isSelected = point.id === selectedPickupPointId;
      const marker = leaflet.marker([point.latitude, point.longitude], {
        icon: leaflet.divIcon({
          className: styles.markerShell,
          html: `<span class="${cn(styles.marker, isSelected && styles.markerSelected)}"></span>`,
          iconAnchor: [22, 22],
          iconSize: [44, 44],
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
          () => onSelectRef.current(point),
          (source) => {
            pendingFocusPickupPointIdRef.current =
              source === "keyboard" && point.id !== selectedPickupPointId ? point.id : undefined;
          },
        ),
      );
    });

    restorePendingMarkerFocus(
      pendingFocusPickupPointIdRef,
      selectedPickupPointId,
      selectedMarkerElement,
    );

    const cleanupMarkerActivations = () => {
      markerActivationCleanups.forEach((cleanup) => cleanup());
    };

    return cleanupMarkerActivations;
  }, [leaflet, pointClusters, selectedPickupPointId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!leaflet || !map || selectedPickupPointId || !fitPoints || !geoPointsFitKey) {
      return;
    }

    fitMapToGeoPointsOnce(map, geoPoints, geoPointsFitKey, previousFitKeyRef);
  }, [fitPoints, geoPoints, geoPointsFitKey, leaflet, selectedPickupPointId]);

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

function fitMapToGeoPointsOnce(
  map: Pick<LeafletMap, "fitBounds" | "setView">,
  geoPoints: readonly Pick<GeoPickupPoint, "latitude" | "longitude">[],
  fitKey: string,
  previousFitKey: PreviousFitKeyRef,
) {
  if (geoPoints.length === 0 || previousFitKey.current === fitKey) {
    return;
  }

  previousFitKey.current = fitKey;
  const bounds = geoPoints.map((point) => [point.latitude, point.longitude] as [number, number]);

  if (bounds.length === 1) {
    const [singlePoint] = bounds;

    if (singlePoint) {
      map.setView(singlePoint, 13);
    }

    return;
  }

  map.fitBounds(bounds as LatLngBoundsExpression, {
    maxZoom: 13,
    padding: [24, 24],
  });
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
