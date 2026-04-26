import { queryOptions } from "@tanstack/react-query";

import { getMyOrders } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";

import type { Order } from "./types";

export type OrdersResult = Order[];

const baseKey = "orders";

export const ordersQuery = {
  baseKey: [baseKey],
  getMyOrders: () =>
    queryOptions({
      queryKey: [baseKey, "my"] as const,
      queryFn: async () => ApiResult.fromDTO(await getMyOrders()).unwrap() ?? [],
      staleTime: 1000 * 30,
      retryOnMount: false,
    }),
};
