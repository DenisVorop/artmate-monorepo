import type { AdminOrder, OrderStatus } from "../model";

export function getOrdersByStatus(
  orders: readonly AdminOrder[],
  status: OrderStatus,
) {
  return orders.filter((order) => order.status === status);
}

export function getOrdersTotal(orders: readonly AdminOrder[]) {
  return orders.reduce((total, order) => total + order.total, 0);
}

export function getOrderCustomerContact(order: AdminOrder) {
  return order.customer.email || order.customer.phone;
}
