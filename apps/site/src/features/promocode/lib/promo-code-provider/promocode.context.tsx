"use client";

import { createContext } from "react";

import type { PromoPreview } from "@/entities/promocode";

export type PromocodeContextValue = {
  applyCode: (_code: string) => void;
  clearCode: () => void;
  error: Error | null;
  isError: boolean;
  isGuest: boolean;
  isHydrating: boolean;
  isPaused: boolean;
  isPending: boolean;
  onLoginRequested?: () => void;
  preview?: PromoPreview;
  retry: () => void;
  selectedCode?: string;
};

export const PromocodeContext = createContext<PromocodeContextValue | null>(null);
