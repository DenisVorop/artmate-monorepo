"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";

import {
  partnerApplicationsQueryKeys,
  type PartnerApplication,
  type PartnerApplicationsPage,
  type PartnerApplicationStatus,
} from "@/entities/partner-applications";
import { updatePartnerApplicationStatus } from "@/shared/actions/partner-applications";

type UpdatePartnerApplicationStatusVariables = {
  readonly applicationId: string;
  readonly status: PartnerApplicationStatus;
};

type MutationContext = {
  readonly previousPages: ReadonlyArray<
    readonly [QueryKey, PartnerApplicationsPage | undefined]
  >;
};

export function useUpdatePartnerApplicationStatus() {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation<
    PartnerApplication,
    Error,
    UpdatePartnerApplicationStatusVariables,
    MutationContext
  >({
    meta: {
      errorMessage: "Не удалось изменить статус заявки",
      successMessage: "Статус партнёрской заявки обновлён",
    },
    mutationFn: async ({ applicationId, status }) => {
      const result = await updatePartnerApplicationStatus(applicationId, {
        status,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onMutate: async ({ applicationId, status }) => {
      await queryClient.cancelQueries({
        queryKey: partnerApplicationsQueryKeys.all,
      });
      const previousPages = queryClient.getQueriesData<PartnerApplicationsPage>(
        {
          queryKey: partnerApplicationsQueryKeys.all,
        },
      );

      queryClient.setQueriesData<PartnerApplicationsPage>(
        { queryKey: partnerApplicationsQueryKeys.all },
        (page) =>
          page
            ? {
                ...page,
                items: page.items.map((application) =>
                  application.id === applicationId
                    ? { ...application, status }
                    : application,
                ),
              }
            : page,
      );

      return { previousPages };
    },
    onError: (_error, _variables, context) => {
      context?.previousPages.forEach(([queryKey, page]) => {
        queryClient.setQueryData(queryKey, page);
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: partnerApplicationsQueryKeys.all,
      });
    },
  });

  return { isPending, mutate };
}
