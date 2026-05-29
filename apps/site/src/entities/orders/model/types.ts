import type {
  OrderCustomerDTO,
  OrderDeliveryDTO,
  OrderDTO,
  OrderPaymentDTO,
  OrderStateDTO,
  OrderStatusDTO,
} from "@/shared/actions/orders";

export type Order = OrderDTO;
export type OrderCustomer = OrderCustomerDTO;
export type OrderDelivery = OrderDeliveryDTO;
export type OrderPayment = OrderPaymentDTO;
export type OrderState = OrderStateDTO;
export type OrderStatus = OrderStatusDTO;
