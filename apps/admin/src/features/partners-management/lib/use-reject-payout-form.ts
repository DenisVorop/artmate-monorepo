"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

import type { AffiliatePayout } from "@/entities/affiliate-partners";

import { useRejectAffiliatePayout } from "../model";
import {
  buildRejectPayoutPayload,
  createPayoutRequestState,
  getRejectPayoutRequestId,
  rejectPayoutFormSchema,
  type PayoutRequestState,
  type RejectPayoutFormValues,
} from "./payout-form-values";
import { getPayoutMutationErrorMessage } from "./payout-presenters";

export function useRejectPayoutForm(payout: AffiliatePayout, userId: string) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const requestState = useRef<PayoutRequestState>(createPayoutRequestState());
  const submitLock = useRef(false);
  const form = useForm<RejectPayoutFormValues>({
    resolver: zodResolver(rejectPayoutFormSchema),
    defaultValues: { reason: "" },
  });
  const { isPending, mutate } = useRejectAffiliatePayout({
    onError: (error) => {
      submitLock.current = false;
      setSubmitError(
        getPayoutMutationErrorMessage(error.code, error.status, error.message),
      );
    },
    onSuccess: () => {
      submitLock.current = false;
      requestState.current = createPayoutRequestState();
      form.reset({ reason: "" });
      setSubmitError(null);
      setOpen(false);
    },
  });

  function changeOpen(nextOpen: boolean) {
    if (isPending) return;
    if (nextOpen && requestState.current.requestId === null) {
      form.reset({ reason: "" });
      setSubmitError(null);
    }
    setOpen(nextOpen);
  }

  const submit = form.handleSubmit((values) => {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitError(null);
    const request = getRejectPayoutRequestId(requestState.current, values);
    requestState.current = request.state;
    mutate({
      userId,
      payoutId: payout.id,
      input: buildRejectPayoutPayload(values, request.requestId),
    });
  });

  return { changeOpen, form, isPending, open, submit, submitError };
}
