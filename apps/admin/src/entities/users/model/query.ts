import { queryOptions } from "@tanstack/react-query";

import { getAdminUsers } from "@/shared/actions/users";

const adminUsersStaleTimeMs = 1000 * 60 * 5;

export const usersQueryKeys = {
  all: ["admin-users"] as const,
  list: () => [...usersQueryKeys.all, "list"] as const,
};

export const usersQuery = {
  list: () =>
    queryOptions({
      queryKey: usersQueryKeys.list(),
      queryFn: getAdminUsers,
      staleTime: adminUsersStaleTimeMs,
      retryOnMount: false,
    }),
};
