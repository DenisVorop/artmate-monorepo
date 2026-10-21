"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useSubmitContactMessageMutation } from "../model";
import { buildContactMessagePayload } from "./contact-message-payload";
import { contactFormDefaultValues, contactFormSchema, type ContactFormValues } from "./form-values";

export function useContactFormState() {
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);
  const mutation = useSubmitContactMessageMutation();
  const form = useForm<ContactFormValues>({
    defaultValues: contactFormDefaultValues,
    resolver: zodResolver(contactFormSchema),
  });
  const submitForm = form.handleSubmit(async (values) => {
    if (submitting.current) return;
    submitting.current = true;
    mutation.reset();
    try {
      await mutation.submitContactMessage(buildContactMessagePayload(values));
      form.reset();
      setSent(true);
    } catch {
      // Keep the form values available for retry; the mutation owns its error.
    } finally {
      submitting.current = false;
    }
  });
  const handleSendAnother = () => {
    form.reset();
    mutation.reset();
    setSent(false);
  };
  return {
    form,
    sent,
    submitForm,
    handleSendAnother,
    isPending: mutation.isPending,
    submitError: mutation.error ? "Не удалось отправить сообщение. Попробуйте ещё раз." : undefined,
  };
}
