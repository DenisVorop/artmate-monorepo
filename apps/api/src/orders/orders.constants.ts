export const ORDER_COMMENT_MAX_LENGTH = 1000;
export const ORDER_ADMIN_COMMENT_MAX_LENGTH = 1000;
export const ORDER_PAYMENT_INITIALIZATION_WAIT_TIMEOUT_MS = 5_000;

export const orderStatuses = [
  "new",
  "in_progress",
  "waiting_payment",
  "paid",
  "delivering",
  "completed",
  "cancelled",
] as const;
export const paymentMethods = [
  "bank_card_mock",
  "ozon_acquiring",
  "tbank_acquiring",
] as const;
export const createOrderPaymentMethods = [
  "ozon_acquiring",
  "tbank_acquiring",
] as const;
export const paymentStatuses = ["pending", "paid", "failed"] as const;
export const deliveryProviders = ["ozon", "cdek"] as const;

export type OrderStatus = (typeof orderStatuses)[number];
export type PaymentMethod = (typeof paymentMethods)[number];
export type CreateOrderPaymentMethod = (typeof createOrderPaymentMethods)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];
export type DeliveryProvider = (typeof deliveryProviders)[number];
