import { isServer, QueryClient } from "@tanstack/react-query";

const adminStaleTimeMs = 1000 * 60 * 5;

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: 0,
      },
      queries: {
        gcTime: adminStaleTimeMs * 2,
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: adminStaleTimeMs,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}
