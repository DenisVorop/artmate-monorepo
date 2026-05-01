import { isServer, MutationCache, QueryClient } from "@tanstack/react-query";

import { showToast } from "./toast-store";

const adminStaleTimeMs = 1000 * 60 * 5;

type ToastMutationMeta = {
  readonly disableToast?: boolean;
  readonly errorMessage?: string;
  readonly successMessage?: string;
};

export function makeQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        const meta = getToastMutationMeta(mutation.meta);

        if (meta.disableToast) {
          return;
        }

        const errorDescription = getErrorDescription(error);

        showToast({
          description:
            meta.errorMessage && errorDescription !== meta.errorMessage
              ? errorDescription
              : undefined,
          title: meta.errorMessage ?? errorDescription,
          variant: "error",
        });
      },
      onSuccess: (_data, _variables, _context, mutation) => {
        const meta = getToastMutationMeta(mutation.meta);

        if (meta.disableToast || !meta.successMessage) {
          return;
        }

        showToast({
          title: meta.successMessage,
          variant: "success",
        });
      },
    }),
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

function getToastMutationMeta(meta: unknown): ToastMutationMeta {
  if (!meta || typeof meta !== "object") {
    return {};
  }

  return meta as ToastMutationMeta;
}

function getErrorDescription(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Запрос не выполнен";
}
