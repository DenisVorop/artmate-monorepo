import { queryOptions } from "@tanstack/react-query";

import { getAuthSession } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

import type { AuthSession } from "./types";

const baseKey = "session";

export const sessionQuery = {
  baseKey: [baseKey],
  getSession: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: async (): Promise<AuthSession> => {
        const result = ApiResult.fromDTO(await getAuthSession());

        return result.isError ? { user: null } : (result.data ?? { user: null });
      },
      staleTime: 1000 * 30,
      retry: false,
      retryOnMount: false,
    }),
};
