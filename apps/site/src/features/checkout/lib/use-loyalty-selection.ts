"use client";

import { useCallback, useEffect, useState } from "react";
import type { CheckoutLoyaltyDTO } from "@/shared/actions/orders";

/** Choices belong to one buyer/cart; promo changes recalculate the spending limit. */
export function useLoyaltySelection(selectionKey: string) {
  const [selection, setSelection] = useState({ key: selectionKey, points: 0 });
  const pointsToSpend = selection.key === selectionKey ? selection.points : 0;
  useEffect(() => setSelection({ key: selectionKey, points: 0 }), [selectionKey]);
  const setPoints = useCallback(
    (points: number) => {
      if (!Number.isSafeInteger(points) || points < 0) return;
      setSelection({ key: selectionKey, points });
    },
    [selectionKey],
  );
  return { selectionKey, pointsToSpend, setPoints };
}

export type CheckoutLoyaltySelection = {
  selectionKey: string;
  pointsToSpend: number;
  preview?: CheckoutLoyaltyDTO;
  isPending: boolean;
  setPoints: (_points: number) => void;
};
