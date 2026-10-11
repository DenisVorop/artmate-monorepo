"use client";

import { createContext } from "react";

export const CheckoutPreviewContext = createContext<{
  hasPromo: boolean;
  setHasPromo: (_value: boolean) => void;
  hasDelivery: boolean;
  setHasDelivery: (_value: boolean) => void;
  notice: string;
} | null>(null);
