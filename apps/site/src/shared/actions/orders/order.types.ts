import type { CartItemDTO } from "@/shared/actions/cart";

export type OrderStatusDTO =
  | "new"
  | "in_progress"
  | "waiting_payment"
  | "paid"
  | "delivering"
  | "completed"
  | "cancelled";
export type OrderPaymentMethodDTO =
  | "bank_card_mock"
  | "ozon_acquiring"
  | "tbank_acquiring";
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

export type OzonPickupPointDTO = PickupPointDTO;

export type CreateOrderDeliveryInputDTO = {
  provider: OrderDeliveryProviderDTO;
  cityCode?: number;
  pickupPointAddress?: string;
  pickupPointId?: string;
};

export type OrderCustomerDTO = {
  name: string;
  phone: string;
  email: string;
};

export type OrderDeliveryDTO = {
  provider: OrderDeliveryProviderDTO;
  pickupPoint: PickupPointDTO;
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
  deliveryPrice: number;
  total: number;
  currency: "RUB";
  delivery: OrderDeliveryDTO;
};

export type CreateOrderInputDTO = {
  customer: OrderCustomerDTO;
  delivery: CreateOrderDeliveryInputDTO;
  payment?: {
    method: OrderPaymentMethodDTO;
  };
  comment?: string;
  acceptedLegal: boolean;
  acceptedPersonalDataConsent: boolean;
};

export type CalculateCheckoutInputDTO = {
  delivery: CreateOrderDeliveryInputDTO;
};

export type ConfirmOrderPaymentInputDTO = {
  orderId: string;
};

export type OrderStateDTO = {
  orderId: string;
  status: OrderStatusDTO;
  paymentStatus: OrderPaymentStatusDTO;
};
