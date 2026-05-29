export {
  getLatestOrder,
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
  OrderState,
  OrderStatus,
} from "./model";
export { OrderCard } from "./ui";
