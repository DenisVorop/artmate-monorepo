import type { CartItemDTO } from "@/shared/actions/cart";

export type OrderStatusDTO = "pending_payment" | "paid";
export type OrderPaymentMethodDTO = "bank_card_mock";
export type OrderPaymentStatusDTO = "pending" | "paid";
export type OrderDeliveryProviderDTO = "ozon";

export type OzonPickupPointDTO = {
  id: string;
  title: string;
  address: string;
  workHours: string;
  deliveryPrice: number;
};

export type OrderCustomerDTO = {
  name: string;
  phone: string;
  email: string;
};

export type OrderDeliveryDTO = {
  provider: OrderDeliveryProviderDTO;
  pickupPoint: OzonPickupPointDTO;
};

export type OrderPaymentDTO = {
  method: OrderPaymentMethodDTO;
  status: OrderPaymentStatusDTO;
  redirectUrl: string;
};

export type OrderDTO = {
  id: string;
  cartId: string;
  status: OrderStatusDTO;
  customer: OrderCustomerDTO;
  delivery: OrderDeliveryDTO;
  payment: OrderPaymentDTO;
  items: CartItemDTO[];
  itemsCount: number;
  subtotal: number;
  deliveryPrice: number;
  total: number;
  currency: "RUB";
  comment?: string;
  createdAt: string;
  paidAt?: string;
};

export type CreateOrderInputDTO = {
  customer: OrderCustomerDTO;
  delivery: {
    provider: OrderDeliveryProviderDTO;
    pickupPointId: string;
  };
  payment: {
    method: OrderPaymentMethodDTO;
  };
  comment?: string;
  acceptedLegal: boolean;
};

export type ConfirmOrderPaymentInputDTO = {
  orderId: string;
};
