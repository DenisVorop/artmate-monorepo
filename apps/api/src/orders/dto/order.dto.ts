import type { CartItemDTO } from "../../cart/dto/cart.dto";

export type OrderStatus = "pending_payment" | "paid";
export type PaymentMethod = "bank_card_mock";
export type PaymentStatus = "pending" | "paid";
export type DeliveryProvider = "ozon";

export type PickupPointDTO = {
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
  provider: DeliveryProvider;
  pickupPoint: PickupPointDTO;
};

export type OrderPaymentDTO = {
  method: PaymentMethod;
  status: PaymentStatus;
  redirectUrl: string;
};

export type OrderDTO = {
  id: string;
  cartId: string;
  status: OrderStatus;
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

export type CreateOrderRequestDTO = {
  customer: OrderCustomerDTO;
  delivery: {
    provider: DeliveryProvider;
    pickupPointId: string;
  };
  payment: {
    method: PaymentMethod;
  };
  comment?: string;
  acceptedLegal: boolean;
};
