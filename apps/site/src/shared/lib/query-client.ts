import { QueryClient } from "@tanstack/react-query";

export const CATALOG_STALE_TIME_MS = 1000 * 60 * 5;

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CATALOG_STALE_TIME_MS,
        gcTime: CATALOG_STALE_TIME_MS * 2,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function createServerQueryClient() {
  return makeQueryClient();
}

export function getBrowserQueryClient() {
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}
