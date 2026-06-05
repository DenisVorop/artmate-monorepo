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

export type OrderItemDTO = {
  id: string;
  title: string;
  slug: string;
  price: number;
  category?: string;
  categorySlug?: string;
  image: string;
  quantity: number;
  lineTotal: number;
};

export type OrderCustomerDTO = {
  name: string;
  phone: string;
  email: string;
};

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

export type OrderDeliveryDTO = {
  provider: OrderDeliveryProviderDTO;
  pickupPoint: PickupPointDTO;
};

export type OrderPaymentDTO = {
  method: OrderPaymentMethodDTO;
  status: OrderPaymentStatusDTO;
  redirectUrl: string;
};

export type AdminOrderCommentDTO = {
  id: string;
  orderId: string;
  authorId?: string;
  authorName?: string;
  body: string;
  createdAt: string;
};

export type AdminOrderHistoryEventDTO = {
  id: string;
  orderId: string;
  authorId?: string;
  authorName?: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
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

export type AdminOrderDTO = {
  id: string;
  cartId: string;
  status: OrderStatusDTO;
  customer: OrderCustomerDTO;
  delivery: OrderDeliveryDTO;
  payment: OrderPaymentDTO;
  items: OrderItemDTO[];
  itemsCount: number;
  subtotal: number;
  deliveryPrice: number;
  total: number;
  currency: "RUB";
  comment?: string;
  adminComments: AdminOrderCommentDTO[];
  history: AdminOrderHistoryEventDTO[];
  shipments: OrderShipmentDTO[];
  createdAt: string;
  paidAt?: string;
};

export type UpdateAdminOrderStatusInputDTO = {
  status: OrderStatusDTO;
};

export type CreateAdminOrderCommentInputDTO = {
  body: string;
};

export type AdminOrderMutationResultDTO =
  | {
      ok: true;
      data: AdminOrderDTO;
    }
  | {
      ok: false;
      error: string;
      status?: number;
    };
