const pendingOrderPaymentStorageKey = "artmate.pendingOrderPaymentId";

export function markPendingOrderPayment(orderId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(pendingOrderPaymentStorageKey, orderId);
}

export function canConfirmPendingOrderPayment(orderId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(pendingOrderPaymentStorageKey) === orderId;
}
