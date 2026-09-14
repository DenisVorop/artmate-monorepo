import crypto from "node:crypto";

import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";

import type { CartItemDTO } from "../cart/dto";
import type { OrderCustomerDTO, OrderDeliveryDTO } from "../orders/dto";
import type { OrderReceiptItemPricing } from "../orders/payment-receipt";

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
  enableFiscalization: true;
  extId: string;
  failUrl: string;
  fiscalizationPhone?: string;
  fiscalizationType: OzonAcquiringFiscalizationType;
  items: OzonAcquiringCreateOrderItem[];
  mode: "MODE_FULL";
  notificationUrl: string;
  paymentAlgorithm: OzonAcquiringPaymentAlgorithm;
  receiptEmail: string;
  requestSign: string;
  successUrl: string;
};

type OzonAcquiringGetOrderStatusRequest =
  | { accessKey: string; extId: string; requestSign: string }
  | { accessKey: string; id: string; requestSign: string };

type OzonAcquiringPaymentAlgorithm = "PAY_ALGO_SMS" | "PAY_ALGO_DMS";

type OzonAcquiringFiscalizationType =
  | "FISCAL_TYPE_SINGLE"
  | "FISCAL_TYPE_DOUBLE"
  | "FISCAL_TYPE_UNSPECIFIED";

const fiscalizationType: OzonAcquiringFiscalizationType = "FISCAL_TYPE_SINGLE";
const checkoutPaymentErrorMessage =
  "Не удалось начать оплату через Ozon. Попробуйте еще раз.";

export type OzonAcquiringCreateCheckoutPaymentInput = {
  amount: number;
  customer: OrderCustomerDTO;
  deliveryPrice: number;
  deliveryProvider: OrderDeliveryDTO["provider"];
  failUrl: string;
  items: CartItemDTO[];
  notificationUrl: string;
  orderId: string;
  receiptPricing?: OrderReceiptItemPricing[];
  successUrl: string;
};

export type OzonAcquiringCreateCheckoutPaymentResult = {
  acquiringOrderId?: string;
  isTestMode?: boolean;
  paymentId?: string;
  redirectUrl: string;
};

export type OzonAcquiringPaymentNotification = Record<string, unknown>;

type OzonAcquiringParsedNotificationFields = {
  acquiringOrderId?: string;
  amount?: string;
  currencyCode?: string;
  errorCode?: string;
  errorMessage?: string;
  extOrderId?: string;
  extTransactionId?: string;
  paymentMethod?: string;
};

export type OzonAcquiringVerifiedNotification = {
  profile: "canonical";
  merchantOrderId?: string;
  acquiringOrderId?: string;
};

export type OzonAcquiringParsedNotification =
  OzonAcquiringParsedNotificationFields & {
    verified: OzonAcquiringVerifiedNotification;
  };

const defaultAcquiringBaseUrl = "https://payapi.ozon.ru";
const orderStatuses = new Set([
  "STATUS_UNSPECIFIED",
  "STATUS_NEW",
  "STATUS_PAYMENT_PENDING",
  "STATUS_PAID",
  "STATUS_PARTITIONAL_REFUND",
  "STATUS_AUTHORIZED",
  "STATUS_CANCELED",
  "STATUS_DISPUTED",
  "STATUS_EXPIRED",
  "STATUS_REFUNDED",
  "STATUS_PARTITION_CANCELED",
  "STATUS_DISPUTING",
]);

@Injectable()
export class OzonAcquiringService {
  private readonly logger = new Logger(OzonAcquiringService.name);

  async createCheckoutPayment(
    input: OzonAcquiringCreateCheckoutPaymentInput,
  ): Promise<OzonAcquiringCreateCheckoutPaymentResult> {
    const accessKey = this.getAccessKey();
    const amount = this.createMoney(input.amount);
    const paymentAlgorithm = this.getPaymentAlgorithm();
    const items = this.createOrderItems(input);
    const itemsAmount = items.reduce(
      (sum, item) => sum + Number(item.price.value) * item.quantity,
      0,
    );
    if (itemsAmount !== Number(amount.value)) {
      throw new BadRequestException({
        message: "Ozon receipt amount must match order total",
        orderAmount: amount.value,
        receiptAmount: String(itemsAmount),
      });
    }
    const requestBody: OzonAcquiringCreateOrderRequest = {
      accessKey,
      amount,
      enableFiscalization: true,
      extId: input.orderId,
      failUrl: input.failUrl,
      ...(input.customer.phone
        ? { fiscalizationPhone: input.customer.phone }
        : {}),
      fiscalizationType,
      items,
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
      checkoutPaymentErrorMessage,
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
      this.logger.warn(
        `Ozon Acquiring /v1/createOrder response does not contain payment redirect URL: ${this.toLogString(
          this.sanitizeForDiagnostics(responseBody),
        )}`,
      );
      throw this.createPublicBadGatewayException(checkoutPaymentErrorMessage, {
        body: this.sanitizeForDiagnostics(responseBody),
      });
    }

    return {
      acquiringOrderId: this.getStringProperty(orderItem, "id"),
      isTestMode: this.getBooleanProperty(orderItem, "isTestMode"),
      paymentId: this.getStringProperty(paymentDetails, "paymentId"),
      redirectUrl,
    };
  }

  async getOrderStatus(
    notification: OzonAcquiringVerifiedNotification,
  ) {
    const requestId = !notification.merchantOrderId
      ? notification.acquiringOrderId
      : undefined;
    const requestExtId = notification.merchantOrderId;
    if (!requestId && !requestExtId) {
      throw new BadGatewayException(
        "Ozon Acquiring notification order identity is missing",
      );
    }

    const accessKey = this.getAccessKey();
    const requestBody: OzonAcquiringGetOrderStatusRequest = {
      accessKey,
      ...(requestExtId ? { extId: requestExtId } : { id: requestId! }),
      requestSign: this.sha256Hex(
        (requestId ?? "") +
          (requestExtId ?? "") +
          accessKey +
          this.getSecretKey(),
      ),
    };
    const responseBody = await this.requestAcquiring(
      "/v1/getOrderStatus",
      requestBody,
    );
    const acquiringOrderId = this.getStringProperty(responseBody, "id");
    const merchantOrderId = this.getStringProperty(responseBody, "extId");
    const status = this.getStringProperty(responseBody, "status");
    const originalAmount = this.getObjectProperty(
      responseBody,
      "originalAmount",
    );
    const currencyCode = this.getStringProperty(
      originalAmount,
      "currencyCode",
    );
    const amount = this.getStringProperty(originalAmount, "value");

    if (
      !acquiringOrderId ||
      !merchantOrderId ||
      (requestId !== undefined && acquiringOrderId !== requestId) ||
      (requestExtId !== undefined && merchantOrderId !== requestExtId) ||
      (notification.acquiringOrderId !== undefined &&
        acquiringOrderId !== notification.acquiringOrderId) ||
      !status ||
      !orderStatuses.has(status) ||
      !currencyCode ||
      !amount ||
      !/^\d+$/.test(amount)
    ) {
      throw this.createPublicBadGatewayException(
        "Ozon Acquiring order status response is invalid",
        { code: "status_lookup_invalid_response" },
      );
    }

    return {
      acquiringOrderId,
      amount,
      currencyCode,
      merchantOrderId,
      status,
    };
  }

  parseNotification(
    notification: OzonAcquiringPaymentNotification,
    verified: OzonAcquiringVerifiedNotification,
  ): OzonAcquiringParsedNotification {
    return {
      acquiringOrderId: this.getStringProperty(notification, "orderID"),
      amount: this.getNotificationValue(notification, "amount"),
      currencyCode: this.getStringProperty(notification, "currencyCode"),
      errorCode: this.getNumberOrStringProperty(notification, "errorCode"),
      errorMessage: this.getStringProperty(notification, "errorMessage"),
      extOrderId: this.getStringProperty(notification, "extOrderID"),
      extTransactionId: this.getStringProperty(
        notification,
        "extTransactionID",
      ),
      paymentMethod: this.getStringProperty(notification, "paymentMethod"),
      verified,
    };
  }

  assertValidNotification(
    notification: OzonAcquiringPaymentNotification,
  ): OzonAcquiringVerifiedNotification {
    const requestSign = this.getStringProperty(notification, "requestSign");

    if (!requestSign) {
      throw new UnauthorizedException(
        "Ozon Acquiring notification signature is missing",
      );
    }

    const signature = this.createNotificationSignature(notification);
    if (!this.isSafeEqual(signature, requestSign)) {
      throw new UnauthorizedException(
        "Ozon Acquiring notification signature is invalid",
      );
    }

    const extOrderId = this.getStringProperty(notification, "extOrderID");
    const extTransactionId = this.getStringProperty(
      notification,
      "extTransactionID",
    );
    const merchantOrderId = extOrderId;
    const acquiringOrderId = this.getStringProperty(notification, "orderID");
    if (!merchantOrderId && !acquiringOrderId) {
      throw new UnauthorizedException(
        "Ozon Acquiring signed merchant order identity or acquiring order id is missing",
      );
    }
    if (extTransactionId && extTransactionId !== merchantOrderId) {
      throw new UnauthorizedException(
        "Ozon Acquiring merchant order identities conflict",
      );
    }

    return Object.freeze({
      profile: "canonical",
      merchantOrderId,
      acquiringOrderId,
    });
  }

  private createNotificationSignature(
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
    const amount = this.getNotificationValue(notification, "amount") ?? "";
    const currencyCode =
      this.getStringProperty(notification, "currencyCode") ?? "";

    return this.sha256Hex(
      [
        accessKey,
        acquiringOrderId,
        transactionId,
        extOrderId,
        amount,
        currencyCode,
        notificationSecretKey,
      ].join("|"),
    );
  }

  private signCreateOrder(input: {
    accessKey: string;
    amount: OzonAcquiringMoney;
    extId: string;
    fiscalizationType: OzonAcquiringFiscalizationType;
    paymentAlgorithm: OzonAcquiringPaymentAlgorithm;
  }) {
    return this.sha256Hex(
      [
        input.accessKey,
        "",
        input.extId,
        input.fiscalizationType,
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
    if (
      input.receiptPricing &&
      (input.receiptPricing.length !== input.items.length ||
        new Set(input.receiptPricing.map((item) => item.id)).size !==
          input.receiptPricing.length)
    ) {
      throw new BadRequestException(
        "Ozon receipt pricing does not match order items",
      );
    }
    const items = input.items.flatMap((item, itemIndex) => {
      const pricing = input.receiptPricing?.find(
        (candidate) => candidate.id === item.id,
      );
      if (!pricing) {
        if (input.receiptPricing) {
          throw new BadRequestException(
            "Ozon receipt pricing is missing an order item",
          );
        }
        return [
          {
            extId: item.id,
            name: item.title,
            needMark: false as const,
            price: this.createMoney(item.price),
            quantity: item.quantity,
            vat: "VAT_NONE" as const,
          },
        ];
      }
      if (
        pricing.priceGroups.reduce((sum, group) => sum + group.quantity, 0) !==
        item.quantity
      ) {
        throw new BadRequestException(
          "Ozon receipt pricing quantity must match order item",
        );
      }
      return pricing.priceGroups.map((group, groupIndex) => ({
        extId: `${input.orderId}-item-${itemIndex}-price-${groupIndex}`,
        name: item.title,
        needMark: false as const,
        price: {
          currencyCode: "643" as const,
          value: String(group.unitPriceKopecks),
        },
        quantity: group.quantity,
        vat: "VAT_NONE" as const,
      }));
    });

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

  private async requestAcquiring(
    path: string,
    body: unknown,
    publicErrorMessage = "Ozon Acquiring request failed",
  ) {
    let response: Response;
    let responseBody: unknown;
    const isStatusLookup = path === "/v1/getOrderStatus";

    try {
      response = await fetch(`${this.getBaseUrl()}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      });
      responseBody = await this.parseResponseBody(response);
    } catch (error) {
      const isTimeout =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      const diagnostic =
        isStatusLookup
          ? { code: isTimeout ? "status_lookup_timeout" : "status_lookup_failed" }
          : error instanceof Error
            ? { message: error.message, name: error.name }
            : error;
      this.logger.warn(
        `Ozon Acquiring ${path} transport failed: ${this.toLogString(diagnostic)}`,
      );
      if (isTimeout) {
        throw new GatewayTimeoutException({
          error: "Gateway Timeout",
          message: publicErrorMessage,
          statusCode: 504,
        });
      }
      throw this.createPublicBadGatewayException(
        publicErrorMessage,
        diagnostic,
      );
    }

    if (!response.ok) {
      if (isStatusLookup) {
        this.logger.warn(
          `Ozon Acquiring ${path} failed with status ${response.status}`,
        );
        throw this.createPublicBadGatewayException(publicErrorMessage, {
          status: response.status,
        });
      }
      const diagnosticBody = this.sanitizeForDiagnostics(responseBody);
      this.logger.warn(
        `Ozon Acquiring ${path} failed with status ${
          response.status
        }: ${this.toLogString(diagnosticBody)}`,
      );

      throw this.createPublicBadGatewayException(publicErrorMessage, {
        body: diagnosticBody,
        status: response.status,
      });
    }

    return responseBody;
  }

  private createPublicBadGatewayException(message: string, cause: unknown) {
    return new BadGatewayException(
      { error: "Bad Gateway", message, statusCode: 502 },
      { cause },
    );
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
