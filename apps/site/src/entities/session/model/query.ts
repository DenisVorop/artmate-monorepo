import { queryOptions } from "@tanstack/react-query";

import { getAuthSession } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

import type { AuthSession } from "./types";

const baseKey = "session";

export const emptySession: AuthSession = {
  user: null,
};

export const sessionQuery = {
  baseKey: [baseKey],
  getSession: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: async () => ApiResult.fromDTO(await getAuthSession()).unwrap() ?? emptySession,
      staleTime: 1000 * 30,
      retryOnMount: false,
    }),
};
