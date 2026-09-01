"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ordersQuery, useOrderData, useOrderStatusData } from "@/entities/orders";

import { getOrderLoadErrorMessage } from "../lib/checkout-success";
import { useTrackPaidOrder } from "../lib/use-track-paid-order";

import { CheckoutSuccessDetails } from "./success-details";
import { CheckoutSuccessState } from "./success-state";

type CheckoutSuccessProps = {
  orderId?: string;
};

const paidOrderRefreshIntervalMs = 3000;

export function CheckoutSuccess({ orderId }: CheckoutSuccessProps) {
  const queryClient = useQueryClient();
  const { data: order, error, isError, isPending } = useOrderData({ orderId });
  const paymentStatus = order?.payment.status;
  const shouldPollPaymentStatus = Boolean(orderId) && paymentStatus === "pending";
  const orderStatus = useOrderStatusData({
    enabled: shouldPollPaymentStatus,
    orderId,
    pollWhilePending: true,
  });
  useTrackPaidOrder(order);

  useEffect(() => {
    if (
      !orderId ||
      orderStatus.data?.paymentStatus !== "paid" ||
      order?.payment.status === "paid"
    ) {
      return;
    }

    const refreshOrder = () => {
      void queryClient.invalidateQueries(
        {
          queryKey: ordersQuery.getOrder(orderId).queryKey,
        },
        { cancelRefetch: false },
      );
    };

    refreshOrder();
    const intervalId = window.setInterval(refreshOrder, paidOrderRefreshIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [order?.payment.status, orderId, orderStatus.data?.paymentStatus, queryClient]);

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
