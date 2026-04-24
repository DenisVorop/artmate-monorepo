import { dehydrate, type DehydratedState, type QueryClient } from "@tanstack/react-query";

type SerializedQueryError = {
  message: string;
  name: string;
  stack?: string;
  status?: number;
} | null;

export function dehydrateQueryClient(queryClient: QueryClient): DehydratedState {
  const dehydratedState = dehydrate(queryClient, {
    shouldDehydrateQuery: (query) =>
      query.state.status === "success" || query.state.status === "error",
  });

  return {
    ...dehydratedState,
    queries: dehydratedState.queries.map((query) => {
      if (query.state.status !== "error") {
        return query;
      }

      const { data: _data, error, fetchFailureReason, ...stateWithoutData } = query.state;

      return {
        ...query,
        state: {
          ...stateWithoutData,
          error: serializeQueryError(error),
          fetchFailureReason: serializeQueryError(fetchFailureReason),
        },
      };
    }),
  } as DehydratedState;
}

function serializeQueryError(error: unknown): SerializedQueryError {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      status: getErrorStatus(error),
    };
  }

  if (typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;

    return {
      message: typeof errorRecord.message === "string" ? errorRecord.message : "Unknown error",
      name: typeof errorRecord.name === "string" ? errorRecord.name : "Error",
      stack: typeof errorRecord.stack === "string" ? errorRecord.stack : undefined,
      status: typeof errorRecord.status === "number" ? errorRecord.status : undefined,
    };
  }

  return {
    message: String(error),
    name: "Error",
  };
}

function getErrorStatus(error: Error) {
  const status = (error as { status?: unknown }).status;

  return typeof status === "number" ? status : undefined;
}
