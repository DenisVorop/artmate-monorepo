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

// Only confirmed delivery milestones belong in the account card's summary.
// Provider request states and free-form status names are not customer-facing milestones.
export function getOrderDeliveryMilestone(shipment: OrderShipment | undefined) {
  const label = getCdekShipmentStatusCodeLabel(shipment?.statusCode);

  switch (label) {
    case "Ожидает в ПВЗ":
      return "Можно забирать";
    case "Ожидает в постамате":
      return "В постамате";
    case "В городе получателя":
    case "Получен":
    case "Не получен":
    case "У курьера":
    case "В пути":
      return label;
    default:
      return undefined;
  }
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
