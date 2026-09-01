"use client";

import { useMutation } from "@tanstack/react-query";

import { communityWorkReportSchema } from "@/entities/community-work";
import { reportCommunityWork, type ReportCommunityWorkInput } from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

export function useReportWork(options: { onSuccess?: () => void } = {}) {
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async ({
      publicId,
      input,
    }: {
      publicId: string;
      input: ReportCommunityWorkInput;
    }) =>
      communityWorkReportSchema.parse(
        ApiResult.fromDTO(await reportCommunityWork(publicId, input)).unwrap(),
      ),
    onSuccess: options.onSuccess,
  });

  return { mutate, isPending };
}
