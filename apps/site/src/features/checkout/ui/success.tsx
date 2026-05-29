"use client";

import { useOrderData, useOrderStatusData } from "@/entities/orders";

import { getOrderLoadErrorMessage } from "../lib/checkout-success";

import { CheckoutSuccessDetails } from "./success-details";
import { CheckoutSuccessState } from "./success-state";

type CheckoutSuccessProps = {
  orderId?: string;
};

export function CheckoutSuccess({ orderId }: CheckoutSuccessProps) {
  const { data: order, error, isError, isPending } = useOrderData({ orderId });
  const paymentStatus = order?.payment.status;
  const shouldPollPaymentStatus = Boolean(orderId) && paymentStatus === "pending";
  const orderStatus = useOrderStatusData({
    enabled: shouldPollPaymentStatus,
    orderId,
    pollWhilePending: true,
  });

  if (!orderId) {
    return (
      <CheckoutSuccessState
        variant="error"
        title="Не найден номер заказа"
        description="Вернитесь в корзину и попробуйте оформить заказ заново."
      />
    );
  }

  if (isPending) {
    return <CheckoutSuccessState title="Загружаем заказ" description="Проверяем детали заказа." />;
  }

  if (isError || !order) {
    return (
      <CheckoutSuccessState
        variant="error"
        title="Не удалось загрузить заказ"
        description={getOrderLoadErrorMessage(error)}
      />
    );
  }

  return (
    <CheckoutSuccessDetails
      isCheckingPayment={orderStatus.isFetching}
      order={order}
      paymentStatus={orderStatus.data?.paymentStatus ?? order.payment.status}
    />
  );
}
