import crypto from "node:crypto";

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";

import type { CartItemDTO } from "../cart/dto";
import type { OrderCustomerDTO, OrderDeliveryDTO } from "../orders/dto";

type OzonAcquiringMoney = {
  currencyCode: "643";
  value: string;
};

type OzonAcquiringCreateOrderItem = {
  extId: string;
  name: string;
  needMark: false;
  price: OzonAcquiringMoney;
  quantity: number;
  vat: "VAT_NONE";
};

type OzonAcquiringCreateOrderRequest = {
  accessKey: string;
  amount: OzonAcquiringMoney;
  enableFiscalization: false;
  extId: string;
  failUrl: string;
  fiscalizationType?: OzonAcquiringFiscalizationType;
  items: OzonAcquiringCreateOrderItem[];
  mode: "MODE_FULL";
  notificationUrl: string;
  paymentAlgorithm: OzonAcquiringPaymentAlgorithm;
  receiptEmail: string;
  requestSign: string;
  successUrl: string;
};

type OzonAcquiringPaymentAlgorithm = "PAY_ALGO_SMS" | "PAY_ALGO_DMS";

type OzonAcquiringFiscalizationType =
  | "FISCAL_TYPE_SINGLE"
  | "FISCAL_TYPE_DOUBLE"
  | "FISCAL_TYPE_UNSPECIFIED";

export type OzonAcquiringCreateCheckoutPaymentInput = {
  amount: number;
  customer: OrderCustomerDTO;
  deliveryPrice: number;
  deliveryProvider: OrderDeliveryDTO["provider"];
  failUrl: string;
  items: CartItemDTO[];
  notificationUrl: string;
  orderId: string;
  successUrl: string;
};

export type OzonAcquiringCreateCheckoutPaymentResult = {
  acquiringOrderId?: string;
  isTestMode?: boolean;
  paymentId?: string;
  redirectUrl: string;
};

export type OzonAcquiringPaymentNotification = Record<string, unknown>;

export type OzonAcquiringParsedNotification = {
  acquiringOrderId?: string;
  amount?: string;
  currencyCode?: string;
  errorCode?: string;
  errorMessage?: string;
  extOrderId?: string;
  extTransactionId?: string;
  paymentMethod?: string;
  status?: string;
  transactionId?: string;
  transactionUid?: string;
};

const defaultAcquiringBaseUrl = "https://payapi.ozon.ru";

@Injectable()
export class OzonAcquiringService {
  private readonly logger = new Logger(OzonAcquiringService.name);

  async createCheckoutPayment(
    input: OzonAcquiringCreateCheckoutPaymentInput,
  ): Promise<OzonAcquiringCreateCheckoutPaymentResult> {
    const accessKey = this.getAccessKey();
    const amount = this.createMoney(input.amount);
    const fiscalizationType = this.getFiscalizationType();
    const paymentAlgorithm = this.getPaymentAlgorithm();
    const requestBody: OzonAcquiringCreateOrderRequest = {
      accessKey,
      amount,
      enableFiscalization: false,
      extId: input.orderId,
      failUrl: input.failUrl,
      fiscalizationType,
      items: this.createOrderItems(input),
      mode: "MODE_FULL",
      notificationUrl: input.notificationUrl,
      paymentAlgorithm,
      receiptEmail: input.customer.email,
      requestSign: this.signCreateOrder({
        accessKey,
        amount,
        extId: input.orderId,
        fiscalizationType,
        paymentAlgorithm,
      }),
      successUrl: input.successUrl,
    };

    const responseBody = await this.requestAcquiring(
      "/v1/createOrder",
      requestBody,
    );
    const paymentDetails = this.getObjectProperty(
      responseBody,
      "paymentDetails",
    );
    const order = this.getObjectProperty(responseBody, "order");
    const orderItem =
      this.getObjectProperty(order, "item") ??
      this.getObjectProperty(responseBody, "order");
    const sbp = this.getObjectProperty(paymentDetails, "sbp");
    const redirectUrl =
      this.getStringProperty(orderItem, "payLink") ??
      this.getStringProperty(sbp, "payload");

    if (!redirectUrl) {
      throw new BadGatewayException({
        message:
          "Ozon Acquiring response does not contain payment redirect URL",
        responseShape: this.getSafeResponseShape(responseBody),
      });
    }

    return {
      acquiringOrderId: this.getStringProperty(orderItem, "id"),
      isTestMode: this.getBooleanProperty(orderItem, "isTestMode"),
      paymentId: this.getStringProperty(paymentDetails, "paymentId"),
      redirectUrl,
    };
  }

  parseNotification(
    notification: OzonAcquiringPaymentNotification,
  ): OzonAcquiringParsedNotification {
    return {
      acquiringOrderId: this.getStringProperty(notification, "orderID"),
      amount: this.getNotificationValue(notification, "amount"),
      currencyCode: this.getStringProperty(notification, "currencyCode"),
      errorCode: this.getStringProperty(notification, "errorCode"),
      errorMessage: this.getStringProperty(notification, "errorMessage"),
      extOrderId: this.getStringProperty(notification, "extOrderID"),
      extTransactionId: this.getStringProperty(
        notification,
        "extTransactionID",
      ),
      paymentMethod: this.getStringProperty(notification, "paymentMethod"),
      status: this.getStringProperty(notification, "status"),
      transactionId: this.getNotificationValue(notification, "transactionID"),
      transactionUid: this.getStringProperty(notification, "transactionUid"),
    };
  }

  assertValidNotification(notification: OzonAcquiringPaymentNotification) {
    const requestSign = this.getStringProperty(notification, "requestSign");

    if (!requestSign) {
      throw new UnauthorizedException(
        "Ozon Acquiring notification signature is missing",
      );
    }

    const candidates = this.createNotificationSignatureCandidates(notification);
    const isValid = candidates.some((candidate) =>
      this.isSafeEqual(candidate, requestSign),
    );

    if (!isValid) {
      throw new UnauthorizedException(
        "Ozon Acquiring notification signature is invalid",
      );
    }
  }

  private createNotificationSignatureCandidates(
    notification: OzonAcquiringPaymentNotification,
  ) {
    const accessKey = this.getAccessKey();
    const notificationSecretKey = this.getNotificationSecretKey();
    const acquiringOrderId =
      this.getStringProperty(notification, "orderID") ?? "";
    const transactionId =
      this.getNotificationValue(notification, "transactionID") ??
      this.getStringProperty(notification, "transactionUid") ??
      "";
    const extOrderId = this.getStringProperty(notification, "extOrderID") ?? "";
    const extTransactionId =
      this.getStringProperty(notification, "extTransactionID") ?? "";
    const amount = this.getNotificationValue(notification, "amount") ?? "";
    const currencyCode =
      this.getStringProperty(notification, "currencyCode") ?? "";

    return [
      this.sha256Hex(
        [
          accessKey,
          acquiringOrderId,
          transactionId,
          extOrderId,
          amount,
          currencyCode,
          notificationSecretKey,
        ].join("|"),
      ),
      this.sha256Hex(
        [
          accessKey,
          "",
          "",
          extTransactionId,
          amount,
          currencyCode,
          notificationSecretKey,
        ].join("|"),
      ),
    ];
  }

  private signCreateOrder(input: {
    accessKey: string;
    amount: OzonAcquiringMoney;
    extId: string;
    fiscalizationType?: OzonAcquiringFiscalizationType;
    paymentAlgorithm: OzonAcquiringPaymentAlgorithm;
  }) {
    return this.sha256Hex(
      [
        input.accessKey,
        "",
        input.extId,
        input.fiscalizationType ?? "",
        input.paymentAlgorithm,
        input.amount.currencyCode,
        input.amount.value,
        this.getSecretKey(),
      ].join(""),
    );
  }

  private createMoney(value: number): OzonAcquiringMoney {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException("Order total must be greater than zero");
    }

    return {
      currencyCode: "643",
      value: String(Math.round(value * 100)),
    };
  }

  private createOrderItems(
    input: OzonAcquiringCreateCheckoutPaymentInput,
  ): OzonAcquiringCreateOrderItem[] {
    const items = input.items.map((item) => ({
      extId: item.id,
      name: item.title,
      needMark: false as const,
      price: this.createMoney(item.price),
      quantity: item.quantity,
      vat: "VAT_NONE" as const,
    }));

    if (input.deliveryPrice > 0) {
      items.push({
        extId: `${input.orderId}-delivery`,
        name: this.getDeliveryItemName(input.deliveryProvider),
        needMark: false,
        price: this.createMoney(input.deliveryPrice),
        quantity: 1,
        vat: "VAT_NONE",
      });
    }

    return items;
  }

  private getDeliveryItemName(provider: OrderDeliveryDTO["provider"]) {
    return provider === "cdek" ? "Доставка CDEK" : "Доставка Ozon";
  }

  private async requestAcquiring(path: string, body: unknown) {
    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const responseBody = await this.parseResponseBody(response);

    if (!response.ok) {
      const diagnosticBody = this.sanitizeForDiagnostics(responseBody);
      const detail = this.getAcquiringErrorDetail(diagnosticBody);
      const message = detail
        ? `Ozon Acquiring request failed: ${detail}`
        : "Ozon Acquiring request failed";

      this.logger.warn(
        `Ozon Acquiring ${path} failed with status ${
          response.status
        }: ${this.toLogString(diagnosticBody)}`,
      );

      throw new BadGatewayException({
        message,
        ozonBody: diagnosticBody,
        ozonStatus: response.status,
      });
    }

    return responseBody;
  }

  private async parseResponseBody(response: Response) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return (await response.json()) as unknown;
    }

    return response.text();
  }

  private getObjectProperty(value: unknown, property: string) {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const propertyValue = (value as Record<string, unknown>)[property];

    return propertyValue && typeof propertyValue === "object"
      ? (propertyValue as Record<string, unknown>)
      : undefined;
  }

  private getStringProperty(value: unknown, property: string) {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const propertyValue = (value as Record<string, unknown>)[property];

    return typeof propertyValue === "string" && propertyValue.trim()
      ? propertyValue.trim()
      : undefined;
  }

  private getBooleanProperty(value: unknown, property: string) {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const propertyValue = (value as Record<string, unknown>)[property];

    return typeof propertyValue === "boolean" ? propertyValue : undefined;
  }

  private getNumberOrStringProperty(value: unknown, property: string) {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const propertyValue = (value as Record<string, unknown>)[property];

    if (typeof propertyValue === "number" && Number.isFinite(propertyValue)) {
      return String(propertyValue);
    }

    return typeof propertyValue === "string" && propertyValue.trim()
      ? propertyValue.trim()
      : undefined;
  }

  private getNotificationValue(
    value: OzonAcquiringPaymentNotification,
    property: string,
  ) {
    const propertyValue = value[property];

    if (typeof propertyValue === "number" && Number.isFinite(propertyValue)) {
      return String(propertyValue);
    }

    return typeof propertyValue === "string" && propertyValue.trim()
      ? propertyValue.trim()
      : undefined;
  }

  private getSafeResponseShape(value: unknown): unknown {
    if (!value || typeof value !== "object") {
      return typeof value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, propertyValue]) => [
        key,
        propertyValue && typeof propertyValue === "object"
          ? this.getSafeResponseShape(propertyValue)
          : typeof propertyValue,
      ]),
    );
  }

  private getAcquiringErrorDetail(value: unknown) {
    if (typeof value === "string" && value.trim()) {
      return this.truncate(value.trim(), 600);
    }

    if (!value || typeof value !== "object") {
      return undefined;
    }

    const message = this.getStringProperty(value, "message");
    const code = this.getNumberOrStringProperty(value, "code");
    const details = (value as Record<string, unknown>).details;
    const detailItems = this.getAcquiringErrorDetailItems(details);

    return [message, code ? `code=${code}` : undefined, ...detailItems]
      .filter((item): item is string => Boolean(item))
      .join("; ");
  }

  private getAcquiringErrorDetailItems(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.getAcquiringErrorDetailItem(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 3);
  }

  private getAcquiringErrorDetailItem(value: unknown) {
    if (typeof value === "string" && value.trim()) {
      return this.truncate(value.trim(), 240);
    }

    if (!value || typeof value !== "object") {
      return undefined;
    }

    const item = value as Record<string, unknown>;
    const directMessage =
      this.getStringProperty(item, "message") ??
      this.getStringProperty(item, "description") ??
      this.getStringProperty(item, "reason") ??
      this.getStringProperty(item, "field");

    if (directMessage) {
      return this.truncate(directMessage, 240);
    }

    return this.truncate(this.toLogString(item, 240), 240);
  }

  private sanitizeForDiagnostics(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeForDiagnostics(item));
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, propertyValue]) => [
        key,
        this.isSensitiveDiagnosticKey(key)
          ? "[redacted]"
          : this.sanitizeForDiagnostics(propertyValue),
      ]),
    );
  }

  private isSensitiveDiagnosticKey(key: string) {
    const normalizedKey = key.toLowerCase();

    return (
      normalizedKey.includes("accesskey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("requestsign") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("token")
    );
  }

  private toLogString(value: unknown, maxLength = 2_000) {
    try {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);

      return this.truncate(serialized ?? String(value), maxLength);
    } catch {
      return this.truncate(String(value), maxLength);
    }
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength
      ? `${value.slice(0, Math.max(0, maxLength - 3))}...`
      : value;
  }

  private getBaseUrl() {
    return (
      this.getOptionalString(process.env.OZON_ACQUIRING_BASE_URL) ??
      defaultAcquiringBaseUrl
    ).replace(/\/+$/, "");
  }

  private getAccessKey() {
    return this.getRequiredEnv("OZON_ACQUIRING_ACCESS_KEY");
  }

  private getSecretKey() {
    return this.getRequiredEnv("OZON_ACQUIRING_SECRET_KEY");
  }

  private getNotificationSecretKey() {
    return this.getRequiredEnv("OZON_ACQUIRING_NOTIFICATION_SECRET_KEY");
  }

  private getPaymentAlgorithm(): OzonAcquiringPaymentAlgorithm {
    const value =
      this.getOptionalString(process.env.OZON_ACQUIRING_PAYMENT_ALGORITHM) ??
      "PAY_ALGO_SMS";

    if (value === "PAY_ALGO_SMS" || value === "PAY_ALGO_DMS") {
      return value;
    }

    throw new InternalServerErrorException(
      "OZON_ACQUIRING_PAYMENT_ALGORITHM must be PAY_ALGO_SMS or PAY_ALGO_DMS",
    );
  }

  private getFiscalizationType(): OzonAcquiringFiscalizationType | undefined {
    const value = this.getOptionalString(
      process.env.OZON_ACQUIRING_FISCALIZATION_TYPE,
    );

    if (!value) {
      return undefined;
    }

    if (
      value === "FISCAL_TYPE_SINGLE" ||
      value === "FISCAL_TYPE_DOUBLE" ||
      value === "FISCAL_TYPE_UNSPECIFIED"
    ) {
      return value;
    }

    throw new InternalServerErrorException(
      "OZON_ACQUIRING_FISCALIZATION_TYPE is invalid",
    );
  }

  private getRequiredEnv(name: string) {
    const value = this.getOptionalString(process.env[name]);

    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }

    return value;
  }

  private getOptionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private sha256Hex(value: string) {
    return crypto.createHash("sha256").update(value, "utf8").digest("hex");
  }

  private isSafeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      crypto.timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
