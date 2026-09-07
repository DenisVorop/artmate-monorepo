import type { CartItemDTO } from "@/shared/actions/cart";

export type OrderStatusDTO =
  | "new"
  | "in_progress"
  | "waiting_payment"
  | "paid"
  | "delivering"
  | "completed"
  | "cancelled";
export type OrderPaymentMethodDTO = "bank_card_mock" | "ozon_acquiring" | "tbank_acquiring";
export type OrderPaymentStatusDTO = "pending" | "paid" | "failed";
export type OrderDeliveryProviderDTO = "ozon" | "cdek";

export type PickupPointDTO = {
  id: string;
  title: string;
  address: string;
  workHours: string;
  deliveryPrice: number;
  cityCode?: number;
  latitude?: number;
  longitude?: number;
};

export type CreateOrderDeliveryInputDTO = {
  provider: OrderDeliveryProviderDTO;
  cityCode?: number;
  pickupPointAddress?: string;
  pickupPointId?: string;
};

export type OrderCustomerDTO = {
  name: string;
  phone?: string;
  email: string;
};

export type CreateOrderCustomerInputDTO = {
  name: string;
  phone: string;
  email: string;
};

export type OrderDeliveryDTO = {
  provider: OrderDeliveryProviderDTO;
  pickupPoint: PickupPointDTO;
};

export type DeliveryDateRangeDTO = {
  min: string;
  max: string;
};

export type OrderPaymentDTO = {
  method: OrderPaymentMethodDTO;
  status: OrderPaymentStatusDTO;
  redirectUrl: string;
};

export type OrderShipmentDTO = {
  provider: OrderDeliveryProviderDTO;
  externalUuid?: string;
  externalNumber?: string;
  requestUuid?: string;
  requestState?: string;
  statusCode?: string;
  statusName?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
};

export type OrderDTO = {
  id: string;
  cartId: string;
  status: OrderStatusDTO;
  customer: OrderCustomerDTO;
  delivery: OrderDeliveryDTO;
  payment: OrderPaymentDTO;
  items: CartItemDTO[];
  shipments: OrderShipmentDTO[];
  itemsCount: number;
  subtotal: number;
  discount: number;
  promoCode?: string | null;
  deliveryPrice: number;
  total: number;
  currency: "RUB";
  comment?: string;
  createdAt: string;
  paidAt?: string;
};

export type CheckoutCalculationDTO = {
  cartId: string;
  itemsCount: number;
  subtotal: number;
  discount: number;
  promoCode?: string | null;
  deliveryPrice: number;
  total: number;
  currency: "RUB";
  delivery: OrderDeliveryDTO;
  estimatedDeliveryDateRange?: DeliveryDateRangeDTO;
};

export type CreateOrderInputDTO = {
  checkoutAttemptId: string;
  customer: CreateOrderCustomerInputDTO;
  delivery: CreateOrderDeliveryInputDTO;
  payment?: {
    method: "ozon_acquiring" | "tbank_acquiring";
  };
  comment?: string;
  acceptedLegal: boolean;
  acceptedPersonalDataConsent: boolean;
  promoCode?: string;
};

export type CreateOrderResponseDTO = {
  itemsCount: number;
  orderId: string;
  redirectUrl: string | null;
  revenue: number;
};

export type PaymentRecoveryResponseDTO = {
  redirectUrl: string | null;
};

export type CalculateCheckoutInputDTO = {
  delivery: CreateOrderDeliveryInputDTO;
  promoCode?: string;
};

export type OrderStateDTO = {
  orderId: string;
  status: OrderStatusDTO;
  paymentStatus: OrderPaymentStatusDTO;
};
