"use client";

import { LoaderCircle } from "lucide-react";

import {
  getPartnerApplicationStatusLabel,
  type PartnerApplicationStatus,
} from "@/entities/partner-applications";
import { partnerApplicationStatuses } from "@/shared/actions/partner-applications";
import { NativeSelect, NativeSelectOption } from "@/shared/ui";

import { useUpdatePartnerApplicationStatus } from "../model";

type StatusControlProps = {
  readonly applicationId: string;
  readonly status: PartnerApplicationStatus;
};

export function StatusControl({ applicationId, status }: StatusControlProps) {
  const { isPending, mutate: updateStatus } =
    useUpdatePartnerApplicationStatus();

  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        aria-label="Статус партнёрской заявки"
        className="w-full min-w-36"
        disabled={isPending}
        onChange={(event) => {
          updateStatus({
            applicationId,
            status: event.target.value as PartnerApplicationStatus,
          });
        }}
        size="sm"
        value={status}
      >
        {partnerApplicationStatuses.map((statusOption) => (
          <NativeSelectOption key={statusOption} value={statusOption}>
            {getPartnerApplicationStatusLabel(statusOption)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {isPending ? (
        <LoaderCircle
          aria-label="Сохраняем статус"
          className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
        />
      ) : null}
    </div>
  );
}
