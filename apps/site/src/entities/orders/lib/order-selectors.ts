import type { Order } from "../model";

export function getLatestOrder(orders: Order[]) {
  return orders[0];
}

export function getPaidOrdersCount(orders: Order[]) {
  return orders.filter((order) => order.status === "paid").length;
}

export function getPreferredCustomerEmail(orders: Order[]) {
  return getLatestOrder(orders)?.customer.email;
}

export function getPreferredCustomerPhone(orders: Order[]) {
  return getLatestOrder(orders)?.customer.phone;
}

export function getOrdersTotal(orders: Order[]) {
  return orders.reduce((total, order) => total + order.total, 0);
}
