import type {
  OrderCustomerDTO,
  OrderDeliveryDTO,
  OrderDTO,
  OrderPaymentDTO,
  OrderShipmentDTO,
  OrderStateDTO,
  OrderStatusDTO,
} from "@/shared/actions/orders";

export type Order = OrderDTO;
export type OrderCustomer = OrderCustomerDTO;
export type OrderDelivery = OrderDeliveryDTO;
export type OrderPayment = OrderPaymentDTO;
export type OrderShipment = OrderShipmentDTO;
export type OrderState = OrderStateDTO;
export type OrderStatus = OrderStatusDTO;
