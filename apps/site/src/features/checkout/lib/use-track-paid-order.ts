"use client";

import { useEffect } from "react";

import type { Order } from "@/entities/orders";

import { useAnalytics } from "./analytics";

export function useTrackPaidOrder(order: Order | undefined) {
  const analytics = useAnalytics();

  useEffect(() => {
    if (order?.payment.status === "paid") {
      analytics.orderPaid(order);
    }
  }, [analytics, order]);
}
