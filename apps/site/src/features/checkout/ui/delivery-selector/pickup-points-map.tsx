"use client";

import type { LayerGroup, Map as LeafletMap, LatLngBoundsExpression } from "leaflet";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DeliveryPickupPointDTO } from "@/shared/actions/delivery";
import { cn } from "@/shared/lib";

import styles from "./pickup-points-map.module.css";

type LeafletModule = typeof import("leaflet");

type PickupPointsMapProps = {
  onSelect: (_point: DeliveryPickupPointDTO) => void;
  pickupPoints: DeliveryPickupPointDTO[];
  selectedPickupPointId?: string;
};

type GeoPickupPoint = DeliveryPickupPointDTO & {
  latitude: number;
  longitude: number;
};

export function PickupPointsMap({
  onSelect,
  pickupPoints,
  selectedPickupPointId,
}: PickupPointsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const [leaflet, setLeaflet] = useState<LeafletModule>();
  const geoPoints = useMemo(() => pickupPoints.filter(isGeoPickupPoint), [pickupPoints]);
  const selectedPoint = geoPoints.find((point) => point.id === selectedPickupPointId);
  const initialPoint = geoPoints[0];

  useEffect(() => {
    let isMounted = true;

    void import("leaflet").then((module) => {
      if (isMounted) {
        setLeaflet(module);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!leaflet || !containerRef.current || !initialPoint || mapRef.current) {
      return;
    }

    const map = leaflet.map(containerRef.current, {
      attributionControl: false,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    leaflet.control.attribution({ prefix: false }).addTo(map);

    leaflet
      .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        // Public OSM tiles require visible attribution and are meant for reasonable traffic.
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      })
      .addTo(map);

    markersRef.current = leaflet.layerGroup().addTo(map);
    mapRef.current = map;
    map.setView([initialPoint.latitude, initialPoint.longitude], 12);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, [initialPoint, leaflet]);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markersRef.current;

    if (!leaflet || !map || !markerLayer) {
      return;
    }

    markerLayer.clearLayers();

    if (geoPoints.length === 0) {
      return;
    }

    const bounds: Array<[number, number]> = [];

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

      marker.on("click", () => onSelect(point));
      marker.bindTooltip(point.address, {
        direction: "top",
        offset: [0, -10],
      });
      marker.addTo(markerLayer);
      bounds.push([point.latitude, point.longitude]);
    });

    if (selectedPoint) {
      map.setView([selectedPoint.latitude, selectedPoint.longitude], 15, {
        animate: true,
      });
      return;
    }

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
  }, [geoPoints, leaflet, onSelect, selectedPickupPointId, selectedPoint]);

  if (geoPoints.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
        <span className="max-w-72">
          Для выбранного города СДЭК не вернул координаты ПВЗ. Выберите пункт выдачи из списка.
        </span>
      </div>
    );
  }

  return (
    <div className={cn(styles.root, "relative overflow-hidden rounded-lg border bg-muted/30")}>
      <div
        ref={containerRef}
        aria-label="Карта пунктов выдачи СДЭК"
        className={cn("h-72 w-full md:h-96", !leaflet && "grid place-items-center")}
      >
        {!leaflet ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" />
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
