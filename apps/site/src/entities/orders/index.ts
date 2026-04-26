export {
  getLatestOrder,
  getOrdersTotal,
  getPaidOrdersCount,
  getPreferredCustomerEmail,
  getPreferredCustomerPhone,
} from "./lib";
export { ordersQuery, useOrdersData } from "./model";
export type { Order, OrderCustomer, OrderDelivery, OrderPayment, OrderStatus } from "./model";
export { OrderCard } from "./ui";
