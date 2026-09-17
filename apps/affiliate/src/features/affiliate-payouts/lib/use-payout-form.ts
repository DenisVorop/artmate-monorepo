"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ChangeEvent, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import type { AffiliatePayoutSummary } from "@/entities/affiliate-payout";
import type { CreateAffiliatePayoutInputDTO } from "@/shared/actions/affiliate";

import { useCreateAffiliatePayout } from "../model/use-create-affiliate-payout";
import { getPayoutErrorMessage } from "./error-message";
import {
  createPayoutFormSchema,
  parseRublesToKopecks,
  sanitizePayoutAmountInput,
  type PayoutFormValues,
} from "./form-values";
import {
  getOrCreatePayoutAttempt,
  shouldRetainPayoutAttempt,
} from "./request-state";

function toRublesInput(kopecks: number) {
  const rubles = Math.floor(kopecks / 100);
  const fraction = String(kopecks % 100).padStart(2, "0");
  return fraction === "00" ? String(rubles) : `${rubles},${fraction}`;
}

export function usePayoutForm(summary: AffiliatePayoutSummary) {
  const { isPending, mutate } = useCreateAffiliatePayout();
  const attemptRef = useRef<CreateAffiliatePayoutInputDTO | null>(null);
  const sendingRef = useRef(false);
  const [confirmation, setConfirmation] = useState<number | null>(null);
  const [isUncertain, setIsUncertain] = useState(false);
  const form = useForm<PayoutFormValues>({
    defaultValues: { amountRubles: "" },
    resolver: zodResolver(
      createPayoutFormSchema({
        availableKopecks: summary.availableKopecks,
        minimumPayoutKopecks: summary.minimumPayoutKopecks,
      }),
    ),
  });
  const registeredAmountField = form.register("amountRubles");
  const amountField = {
    ...registeredAmountField,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      const sanitized = sanitizePayoutAmountInput(input.value);

      input.value = sanitized;
      void registeredAmountField.onChange(event);
      form.clearErrors("root");

      if (selectionStart !== null && selectionEnd !== null) {
        input.setSelectionRange(
          Math.min(selectionStart, sanitized.length),
          Math.min(selectionEnd, sanitized.length),
        );
      }
    },
  };

  const prepare = form.handleSubmit((values) => {
    form.clearErrors("root");
    const amountKopecks = parseRublesToKopecks(values.amountRubles);
    if (amountKopecks === null) return;
    const input = getOrCreatePayoutAttempt(
      attemptRef.current,
      amountKopecks,
      () => crypto.randomUUID(),
    );
    attemptRef.current = input;
    setConfirmation(input.amountKopecks);
  });

  const confirm = async () => {
    const input = attemptRef.current;
    if (!input || sendingRef.current) return;
    sendingRef.current = true;

    try {
      const result = await mutate(input);
      if (!result.ok) {
        const retainAttempt = shouldRetainPayoutAttempt(result.error.status);
        setIsUncertain(retainAttempt);
        if (!retainAttempt) {
          attemptRef.current = null;
        }
        setConfirmation(null);
        form.setError("root", {
          message: getPayoutErrorMessage(result.error.status, result.error.code),
        });
        return;
      }

      attemptRef.current = null;
      setConfirmation(null);
      setIsUncertain(false);
      form.reset({ amountRubles: "" });
    } catch {
      setConfirmation(null);
      setIsUncertain(true);
      form.setError("root", { message: getPayoutErrorMessage(503) });
    } finally {
      sendingRef.current = false;
    }
  };

  const retryUncertain = () => {
    const input = attemptRef.current;
    if (input && !sendingRef.current) {
      form.clearErrors("root");
      setConfirmation(input.amountKopecks);
    }
  };

  const cancelConfirmation = () => {
    if (!isPending) {
      setConfirmation(null);
      if (!isUncertain) attemptRef.current = null;
    }
  };

  const useFullBalance = () => {
    if (isUncertain) return;
    form.clearErrors();
    form.setValue("amountRubles", toRublesInput(summary.availableKopecks), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return {
    amountField,
    cancelConfirmation,
    confirm,
    confirmation,
    form,
    isPending,
    isUncertain,
    prepare,
    retryUncertain,
    useFullBalance,
  };
}
