import { queryOptions } from "@tanstack/react-query";

import { getPartnerApplications } from "@/shared/actions/partner-applications";

import type { PartnerApplicationsListParams } from "./types";

const adminPartnerApplicationsStaleTimeMs = 1000 * 30;

export const partnerApplicationsQueryKeys = {
  all: ["admin-partner-applications"] as const,
  list: (params: PartnerApplicationsListParams) =>
    [...partnerApplicationsQueryKeys.all, "list", params] as const,
};

export const partnerApplicationsQuery = {
  list: (params: PartnerApplicationsListParams) =>
    queryOptions({
      queryKey: partnerApplicationsQueryKeys.list(params),
      queryFn: () => getPartnerApplications(params),
      staleTime: adminPartnerApplicationsStaleTimeMs,
      retryOnMount: false,
    }),
};
