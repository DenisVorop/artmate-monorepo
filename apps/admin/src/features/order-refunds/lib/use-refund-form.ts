"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import type { OrderRefunds } from "@/entities/order-refund";

import { useRecordOrderRefund } from "../model";
import {
  buildRefundPayload,
  calculateRefundPreviewKopecks,
  createOrderRefundFormSchema,
  createRefundRequestState,
  formatKopecksInput,
  getOrderRefundDefaultValues,
  getRefundRequestId,
  type OrderRefundFormValues,
  type RefundRequestState,
} from "./form-values";

export function useRefundForm(data: OrderRefunds) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const requestState = useRef<RefundRequestState>(createRefundRequestState());
  const formItems = useRef(data.items);
  const form = useForm<OrderRefundFormValues>({
    resolver: zodResolver(
      createOrderRefundFormSchema(
        formItems.current,
        data.delivery.refundableKopecks,
      ),
    ),
    defaultValues: getOrderRefundDefaultValues(formItems.current),
    mode: "onChange",
  });
  const quantities = useWatch({ control: form.control, name: "quantities" });
  const deliveryRubles = useWatch({
    control: form.control,
    name: "deliveryRubles",
  });
  const previewKopecks = calculateRefundPreviewKopecks(
    formItems.current,
    quantities ?? [],
    deliveryRubles ?? "",
  );
  const { isPending, mutate } = useRecordOrderRefund({
    onError: (error) => {
      setSubmitError(
        error.status === 409
          ? `Возврат уже был учтен или данные операции изменились. ${error.message}`
          : error.message || "Не удалось учесть возврат. Попробуйте еще раз.",
      );
    },
    onSuccess: (updatedData) => {
      formItems.current = updatedData.items;
      form.reset(getOrderRefundDefaultValues(updatedData.items));
      requestState.current = createRefundRequestState();
      setSubmitError(null);
      setOpen(false);
    },
  });

  function changeOpen(nextOpen: boolean) {
    if (isPending) return;

    if (nextOpen && requestState.current.requestId === null) {
      formItems.current = data.items;
      form.reset(getOrderRefundDefaultValues(data.items));
      setSubmitError(null);
    }
    setOpen(nextOpen);
  }

  function submit(values: OrderRefundFormValues) {
    setSubmitError(null);
    const request = getRefundRequestId(
      requestState.current,
      values,
      formItems.current,
    );
    requestState.current = request.state;
    mutate({
      orderId: data.orderId,
      payload: buildRefundPayload(values, formItems.current, request.requestId),
    });
  }

  function setFullRemainingRefund() {
    formItems.current.forEach((item, index) => {
      form.setValue(`quantities.${index}`, item.remainingQuantity, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
    form.setValue(
      "deliveryRubles",
      formatKopecksInput(data.delivery.refundableKopecks),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  return {
    changeOpen,
    form,
    isPending,
    items: formItems.current,
    open,
    previewKopecks,
    setFullRemainingRefund,
    submit: form.handleSubmit(submit),
    submitError,
  };
}
