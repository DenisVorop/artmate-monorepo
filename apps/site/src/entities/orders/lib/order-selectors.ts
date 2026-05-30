import type { Order, OrderShipment } from "../model";

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

export function getCdekShipment(order: Order) {
  return order.shipments.find((shipment) => shipment.provider === "cdek");
}

export function getOrderShipmentStatusLabel(shipment: OrderShipment | undefined) {
  if (!shipment) {
    return undefined;
  }

  if (shipment.statusName) {
    return shipment.statusName;
  }

  switch (shipment.requestState) {
    case "CREATING":
      return "Создаем накладную СДЭК";
    case "ACCEPTED":
      return "Накладная СДЭК принята";
    case "SUCCESSFUL":
      return "Накладная СДЭК создана";
    case "INVALID":
    case "ERROR":
      return "Статус доставки уточняется";
    default:
      return shipment.externalUuid ? "Накладная СДЭК создана" : undefined;
  }
}

export function getOrderShipmentNumberLabel(shipment: OrderShipment | undefined) {
  if (!shipment?.externalNumber) {
    return undefined;
  }

  return `Накладная ${shipment.externalNumber}`;
}
