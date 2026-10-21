"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/features/auth";
import type { SubmitPartnerApplicationInputDTO } from "@/shared/actions/partner-applications";

import { useSubmitPartnerApplication } from "../model";
import { trackPartnerProgramEvent } from "./analytics";
import {
  partnerApplicationFormDefaultValues,
  partnerApplicationFormSchema,
  type PartnerApplicationFormValues,
} from "./form-values";
import { buildPartnerApplicationPayload } from "./payload";

export function usePartnerApplicationState() {
  const [sent, setSent] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const startedRef = useRef(false);
  const submitting = useRef(false);
  const mutation = useSubmitPartnerApplication();
  const form = useForm<PartnerApplicationFormValues>({
    defaultValues: partnerApplicationFormDefaultValues,
    resolver: zodResolver(partnerApplicationFormSchema),
  });
  useEffect(() => {
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        'a[href="#partner-application"]',
      ),
    );
    const trackClick = () => trackPartnerProgramEvent("partner_cta_click");
    links.forEach((link) => link.addEventListener("click", trackClick));
    return () =>
      links.forEach((link) => link.removeEventListener("click", trackClick));
  }, []);
  const { onAuth, isPending: isAuthPending } =
    useAuth<SubmitPartnerApplicationInputDTO>({
      onSuccess: async (_user, payload) => {
        try {
          await mutation.submitPartnerApplication(payload);
        } catch (error) {
          trackPartnerProgramEvent("partner_form_error");
          throw error;
        }
        trackPartnerProgramEvent("partner_form_success");
        form.reset();
        setSent(true);
      },
      onError: (error) => {
        if (error.code !== "cancelled")
          setAuthError("Не удалось завершить вход. Попробуйте ещё раз.");
      },
    });
  const submitForm = form.handleSubmit(async (values) => {
    if (submitting.current) return;
    submitting.current = true;
    mutation.reset();
    setAuthError(undefined);
    const payload = Object.freeze(buildPartnerApplicationPayload(values));
    try {
      await onAuth(payload);
    } catch {
      // Business failure is displayed by the mutation. Cancellation preserves the form.
    } finally {
      submitting.current = false;
    }
  });
  const handleFormStart = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackPartnerProgramEvent("partner_form_start");
  };
  const handleSendAnother = () => {
    startedRef.current = false;
    form.reset();
    mutation.reset();
    setAuthError(undefined);
    setSent(false);
  };
  return {
    form,
    sent,
    submitForm,
    handleFormStart,
    handleSendAnother,
    isPending: isAuthPending || mutation.isPending,
    submitError: mutation.error
      ? "Не удалось отправить заявку. Попробуйте ещё раз."
      : authError,
  };
}
