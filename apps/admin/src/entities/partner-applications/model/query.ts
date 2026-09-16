import { queryOptions } from "@tanstack/react-query";

import { getPartnerApplications } from "@/shared/actions/partner-applications";

import type { PartnerApplicationsListParams } from "./types";
import { collectPartnerApplicationSelection } from "./selection";

const adminPartnerApplicationsStaleTimeMs = 1000 * 30;

export const partnerApplicationsQueryKeys = {
  all: ["admin-partner-applications"] as const,
  list: (params: PartnerApplicationsListParams) =>
    [...partnerApplicationsQueryKeys.all, "list", params] as const,
  selection: () => [...partnerApplicationsQueryKeys.all, "selection"] as const,
};

export const partnerApplicationsQuery = {
  selection: () =>
    queryOptions({
      queryKey: partnerApplicationsQueryKeys.selection(),
      queryFn: () => collectPartnerApplicationSelection(getPartnerApplications),
      staleTime: adminPartnerApplicationsStaleTimeMs,
      retryOnMount: false,
    }),
  list: (params: PartnerApplicationsListParams) =>
    queryOptions({
      queryKey: partnerApplicationsQueryKeys.list(params),
      queryFn: () => getPartnerApplications(params),
      staleTime: adminPartnerApplicationsStaleTimeMs,
      retryOnMount: false,
    }),
};
