import { queryOptions } from "@tanstack/react-query";

import { getCart } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";

import type { Cart } from "./types";

export type CartResult = Cart | null;

const baseKey = "cart";

export const cartQuery = {
  baseKey: [baseKey],
  getCart: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: async () => ApiResult.fromDTO(await getCart()).unwrap() ?? null,
      staleTime: 1000 * 30,
      retryOnMount: false,
    }),
};
