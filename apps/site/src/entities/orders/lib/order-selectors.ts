import type { Order, OrderShipment } from "../model";

export const cdekTrackingUrl = "https://www.cdek.ru/ru/tracking";

const cdekShipmentStatusLabels: Record<string, string> = {
  ACCEPTED: "Создан",
  ACCEPTED_AT_PICK_UP_POINT: "Ожидает в ПВЗ",
  ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE: "В городе получателя",
  ACCEPTED_IN_RECIPIENT_CITY: "В городе получателя",
  DELIVERED: "Получен",
  ENTERED_TO_PICK_UP_POINT: "Ожидает в ПВЗ",
  NOT_DELIVERED: "Не получен",
  POSTOMAT_POSTED: "Ожидает в постамате",
  READY_FOR_DELIVERY: "Ожидает в ПВЗ",
  READY_FOR_PICKUP: "Ожидает в ПВЗ",
  REMOVED: "Удален",
  TAKEN_BY_COURIER: "У курьера",
} as const;

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

  const statusCodeLabel = getCdekShipmentStatusCodeLabel(shipment.statusCode);

  if (statusCodeLabel) {
    return statusCodeLabel;
  }

  if (shipment.statusName) {
    return normalizeCdekShipmentStatusName(shipment.statusName);
  }

  switch (shipment.requestState) {
    case "CREATING":
      return "Создается";
    case "ACCEPTED":
    case "SUCCESSFUL":
      return "Создан";
    case "INVALID":
    case "ERROR":
      return "Статус уточняется";
    default:
      return shipment.externalUuid ? "Создан" : undefined;
  }
}

export function getOrderShipmentNumberLabel(shipment: OrderShipment | undefined) {
  if (!shipment?.externalNumber) {
    return undefined;
  }

  return shipment.externalNumber;
}

function getCdekShipmentStatusCodeLabel(statusCode: string | undefined) {
  if (!statusCode) {
    return undefined;
  }

  const normalizedStatusCode = statusCode.toUpperCase();
  const exactLabel = cdekShipmentStatusLabels[normalizedStatusCode];

  if (exactLabel) {
    return exactLabel;
  }

  if (
    normalizedStatusCode.includes("TRANSIT") ||
    normalizedStatusCode.includes("TRANSPORT") ||
    normalizedStatusCode.includes("SHIPMENT") ||
    normalizedStatusCode.includes("SHIPPED") ||
    normalizedStatusCode.includes("SENT")
  ) {
    return "В пути";
  }

  return undefined;
}

function normalizeCdekShipmentStatusName(statusName: string) {
  const normalizedStatusName = statusName.trim();
  const lowerStatusName = normalizedStatusName.toLowerCase();

  if (lowerStatusName === "принят") {
    return "Создан";
  }

  if (
    lowerStatusName.includes("пвз") ||
    lowerStatusName.includes("пункт выдачи") ||
    lowerStatusName.includes("до востребования")
  ) {
    return "Ожидает в ПВЗ";
  }

  return normalizedStatusName;
}
