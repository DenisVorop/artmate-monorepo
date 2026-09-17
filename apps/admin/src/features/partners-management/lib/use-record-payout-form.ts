"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

import type { AffiliatePayout } from "@/entities/affiliate-partners";

import { useRecordAffiliatePayout } from "../model";
import {
  buildPaidPayoutPayload,
  createPaidPayoutFormSchema,
  createPayoutRequestState,
  getPaidPayoutRequestId,
  toLocalDateTimeInput,
  type PaidPayoutFormValues,
  type PayoutRequestState,
} from "./payout-form-values";
import { getPayoutMutationErrorMessage } from "./payout-presenters";

export function useRecordPayoutForm(payout: AffiliatePayout, userId: string) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const requestState = useRef<PayoutRequestState>(createPayoutRequestState());
  const submitLock = useRef(false);
  const form = useForm<PaidPayoutFormValues>({
    resolver: zodResolver(createPaidPayoutFormSchema(payout.createdAt)),
    defaultValues: getDefaultValues(),
  });
  const { isPending, mutate } = useRecordAffiliatePayout({
    onError: (error) => {
      submitLock.current = false;
      setSubmitError(
        getPayoutMutationErrorMessage(error.code, error.status, error.message),
      );
    },
    onSuccess: () => {
      submitLock.current = false;
      requestState.current = createPayoutRequestState();
      form.reset(getDefaultValues());
      setSubmitError(null);
      setOpen(false);
    },
  });

  function changeOpen(nextOpen: boolean) {
    if (isPending) return;
    if (nextOpen && requestState.current.requestId === null) {
      form.reset(getDefaultValues());
      setSubmitError(null);
    }
    setOpen(nextOpen);
  }

  const submit = form.handleSubmit((values) => {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitError(null);
    const request = getPaidPayoutRequestId(requestState.current, values);
    requestState.current = request.state;
    mutate({
      userId,
      payoutId: payout.id,
      input: buildPaidPayoutPayload(values, request.requestId),
    });
  });

  return {
    changeOpen,
    form,
    isPending,
    maxPaidAt: toLocalDateTimeInput(new Date()),
    minPaidAt: toLocalDateTimeInput(new Date(payout.createdAt)),
    open,
    submit,
    submitError,
  };
}

function getDefaultValues(): PaidPayoutFormValues {
  return {
    paidAt: toLocalDateTimeInput(new Date()),
    reference: "",
    confirmed: false,
  };
}
