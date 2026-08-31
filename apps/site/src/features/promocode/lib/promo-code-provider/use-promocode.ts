"use client";

import { use } from "react";

import { PromocodeContext } from "./promocode.context";

export function usePromocode() {
  const context = use(PromocodeContext);

  if (!context) {
    throw new Error("usePromocode must be used within PromocodeProvider");
  }

  return context;
}
