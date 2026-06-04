import type { AdminOrder, OrderStatus } from "../model";

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

type OrderShipment = AdminOrder["shipments"][number];

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

export function getCdekShipment(order: AdminOrder) {
  return order.shipments.find((shipment) => shipment.provider === "cdek");
}

export function getOrderShipmentStatusLabel(
  shipment: OrderShipment | undefined,
) {
  if (!shipment) {
    return "Не создан";
  }

  if (shipment.errorMessage) {
    return shipment.requestState === "DELETE_ERROR"
      ? "Ошибка удаления"
      : "Ошибка создания";
  }

  if (
    shipment.statusCode === "REMOVED" ||
    shipment.requestState === "DELETE_SUCCESSFUL"
  ) {
    return "Удален";
  }

  if (shipment.requestState?.startsWith("DELETE_")) {
    return "Удаляется";
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
      return "Отклонен";
    case "ERROR":
      return "Ошибка";
    default:
      return shipment.externalUuid
        ? "Создан"
        : (shipment.requestState ?? "Принят");
  }
}

export function getOrderShipmentNumber(shipment: OrderShipment | undefined) {
  return shipment?.externalNumber;
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
