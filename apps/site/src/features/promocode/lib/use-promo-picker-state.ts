"use client";
import { useState } from "react";
import type { PersonalPromoCode } from "./personal-promocodes";

export type PromoPickerView = "list" | "manual" | "details";

export function usePromoPickerState() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PromoPickerView>("list");
  const [details, setDetails] = useState<PersonalPromoCode | null>(null);
  const [detailsFromList, setDetailsFromList] = useState(false);
  function show(view: "list" | "manual") {
    setView(view);
    setOpen(true);
  }
  function showDetails(code: PersonalPromoCode, fromList: boolean) {
    setDetails(code);
    setDetailsFromList(fromList);
    setView("details");
    setOpen(true);
  }
  return {
    open,
    setOpen,
    view,
    setView,
    show,
    details,
    detailsFromList,
    showDetails,
    close: () => setOpen(false),
  };
}
