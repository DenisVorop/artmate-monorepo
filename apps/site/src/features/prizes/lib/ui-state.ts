"use client";
import { useState } from "react";
import type { DeliveryPickerDrafts } from "@/widgets/pickup-point-picker";
import type { PrizePickupSelection } from "./types";
export function usePrizeListState() {
  const [tab, setTab] = useState("available");
  return { tab, setTab };
}
export function useProductSearch() {
  const [search, setSearch] = useState("");
  return { search, setSearch };
}
export function usePickupPickerState(selected?: PrizePickupSelection) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<DeliveryPickerDrafts>({ cdek: {}, ozon: {} });
  const candidate =
    drafts.ozon.city && drafts.ozon.pickupPoint
      ? { city: drafts.ozon.city, point: drafts.ozon.pickupPoint }
      : undefined;
  function openPicker() {
    setDrafts({
      cdek: {},
      ozon: selected
        ? {
            city: selected.city,
            cityCode: selected.city.code,
            pickupPoint: selected.point,
            pickupPointId: selected.point.id,
          }
        : {},
    });
    setOpen(true);
  }
  return { open, setOpen, drafts, setDrafts, candidate, openPicker };
}
