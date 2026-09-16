import { dehydrate, type QueryClient } from "@tanstack/react-query";

export function dehydrateQueryClient(queryClient: QueryClient) {
  return dehydrate(queryClient, {
    shouldDehydrateQuery: (query) =>
      query.state.status === "success" || query.state.status === "error",
  });
}
