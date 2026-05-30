export {
  getCdekShipment,
  getLatestOrder,
  getOrderShipmentNumberLabel,
  getOrderShipmentStatusLabel,
  getOrdersTotal,
  getPaidOrdersCount,
  getPreferredCustomerEmail,
  getPreferredCustomerPhone,
} from "./lib";
export { ordersQuery, useOrderData, useOrderStatusData, useOrdersData } from "./model";
export type {
  Order,
  OrderCustomer,
  OrderDelivery,
  OrderPayment,
  OrderShipment,
  OrderState,
  OrderStatus,
} from "./model";
export { OrderCard } from "./ui";
