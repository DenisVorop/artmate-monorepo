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
import type { OrderReceiptItemPricing } from "../orders/payment-receipt";

type TBankAcquiringPayType = "O" | "T";

type TBankReceiptPaymentMethod =
  | "full_prepayment"
  | "prepayment"
  | "advance"
  | "full_payment"
  | "partial_payment"
  | "credit"
  | "credit_payment";

type TBankReceiptPaymentObject = "commodity" | "service";

type TBankReceiptTax =
  | "none"
  | "vat0"
  | "vat5"
  | "vat7"
  | "vat10"
  | "vat20"
  | "vat22"
  | "vat105"
  | "vat107"
  | "vat110"
  | "vat120"
  | "vat122";

type TBankReceiptTaxation =
  | "osn"
  | "usn_income"
  | "usn_income_outcome"
  | "esn"
  | "patent";

type TBankReceiptItem = {
  Amount: number;
  Name: string;
  PaymentMethod: TBankReceiptPaymentMethod;
  PaymentObject: TBankReceiptPaymentObject;
  Price: number;
  Quantity: number;
  Tax: TBankReceiptTax;
};

type TBankReceipt = {
  Email: string;
  Items: TBankReceiptItem[];
  Payments: {
    Electronic: number;
  };
  Phone?: string;
  Taxation: TBankReceiptTaxation;
};

type TBankInitRequest = {
  Amount: number;
  DATA: Record<string, string>;
  Description: string;
  FailURL: string;
  Language: "ru";
  NotificationURL: string;
  OrderId: string;
  PayType: TBankAcquiringPayType;
  Receipt: TBankReceipt;
  SuccessURL: string;
  TerminalKey: string;
  Token: string;
};

export type TBankAcquiringCreateCheckoutPaymentInput = {
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

export type TBankAcquiringCreateCheckoutPaymentResult = {
  acquiringOrderId?: string;
  paymentId?: string;
  redirectUrl: string;
};

export type TBankAcquiringReconciliationInput = {
  orderId: string;
  paymentId?: string;
  amountKopecks: number;
};

export type TBankAcquiringReconciliationResult = {
  state: "paid" | "closed_unpaid" | "pending" | "attention";
  paymentId?: string;
  reason?: string;
};

type CheckedPayment = { paymentId: string; status: string };
type CheckedOrder = { payments: CheckedPayment[] } | { reason: string };

export type TBankAcquiringPaymentNotification = Record<string, unknown>;

export type TBankAcquiringParsedNotification = {
  amount?: string;
  errorCode?: string;
  errorMessage?: string;
  orderId?: string;
  paymentId?: string;
  rawStatus?: string;
  status?: string;
  success?: boolean;
  terminalKey?: string;
};

const defaultAcquiringBaseUrl = "https://securepay.tinkoff.ru";
const successfulPaymentStatuses = new Set(["CONFIRMED"]);
// AUTHORIZED is a hold, not a captured payment. Unknown/error/refund states
// require reconciliation rather than a guessed successful/closed outcome.
const pendingPaymentStatuses = new Set([
  "NEW",
  "FORM_SHOWED",
  "PREAUTHORIZING",
  "AUTHORIZING",
  "3DS_CHECKING",
  "3DS_CHECKED",
  "AUTHORIZED",
  "CONFIRMING",
  "CONFIRM_CHECKING",
  "PAY_CHECKING",
]);
const failedPaymentStatuses = new Set([
  "CANCELED",
  "DEADLINE_EXPIRED",
  "REJECTED",
]);
const checkoutPaymentErrorMessage =
  "Не удалось начать оплату через T-Bank. Попробуйте еще раз.";

@Injectable()
export class TBankAcquiringService {
  private readonly logger = new Logger(TBankAcquiringService.name);

  /** The caller must prevent new payment attempts while checking/closing the order. */
  async verifyOrderClosedUnpaid(input: {
    orderId: string;
    paymentId: string;
    amountKopecks: number;
  }): Promise<boolean> {
    assertReconciliationInput(input);
    if (!isPaymentId(input.paymentId)) {
      throw new BadRequestException("Invalid T-Bank closed-payment identity");
    }
    const terminalKey = this.getTerminalKey();
    const checked = await this.checkOrderPayments(input, terminalKey);
    if (
      "reason" in checked ||
      !checked.payments.every((payment) =>
        isClosedUnpaidStatus(payment.status),
      ) ||
      !checked.payments.some((payment) => payment.paymentId === input.paymentId)
    )
      return false;
    const state = await this.getPaymentState(input.paymentId, terminalKey);
    return (
      isMatchingPaymentState(state, terminalKey, input, input.paymentId) &&
      isClosedUnpaidStatus(state.Status)
    );
  }

  /** Read-only; the caller must prohibit new/in-flight Init attempts for this order. */
  async reconcilePayment(
    input: TBankAcquiringReconciliationInput,
  ): Promise<TBankAcquiringReconciliationResult> {
    assertReconciliationInput(input);
    const terminalKey = this.getTerminalKey();
    const checked = await this.checkOrderPayments(input, terminalKey);
    if ("reason" in checked)
      return { state: "attention", reason: checked.reason };
    const { payments } = checked;
    if (
      input.paymentId &&
      !payments.some((payment) => payment.paymentId === input.paymentId)
    )
      return { state: "attention", reason: "identity_mismatch" };

    const nonClosed = payments.filter(
      (payment) => !isClosedUnpaidStatus(payment.status),
    );
    if (
      nonClosed.some(
        (payment) =>
          payment.status !== "CONFIRMED" &&
          !pendingPaymentStatuses.has(payment.status),
      )
    )
      return { state: "attention", reason: "closure_unconfirmed" };
    if (nonClosed.length > 1)
      return { state: "attention", reason: "payment_ambiguous" };
    const selected = input.paymentId
      ? payments.find((payment) => payment.paymentId === input.paymentId)!
      : (nonClosed[0] ?? (payments.length === 1 ? payments[0] : undefined));
    if (!selected) return { state: "attention", reason: "payment_ambiguous" };
    if (
      nonClosed.length === 1 &&
      nonClosed[0]!.paymentId !== selected.paymentId
    )
      return { state: "attention", reason: "identity_mismatch" };

    const paymentId = selected.paymentId;
    const state = await this.getPaymentState(paymentId, terminalKey);
    if (!isMatchingPaymentState(state, terminalKey, input, paymentId))
      return {
        state: "attention",
        reason:
          paymentStateProblem(state, terminalKey, input, paymentId) ??
          "provider_error",
      };
    // The fresh read is authoritative for an actual capture, even if it
    // contradicts older closure evidence; downstream must preserve that fact.
    if (state.Status === "CONFIRMED") return { state: "paid", paymentId };
    if (isClosedUnpaidStatus(state.Status)) {
      if (nonClosed.length === 0) return { state: "closed_unpaid", paymentId };
      if (selected.status !== "CONFIRMED")
        return { state: "pending", paymentId, reason: "closure_unconfirmed" };
    }
    if (
      pendingPaymentStatuses.has(state.Status as string) &&
      pendingPaymentStatuses.has(selected.status)
    )
      return { state: "pending", paymentId };
    return { state: "attention", paymentId, reason: "closure_unconfirmed" };
  }

  private async checkOrderPayments(
    input: TBankAcquiringReconciliationInput,
    terminalKey: string,
  ): Promise<CheckedOrder> {
    const checkRequest = { TerminalKey: terminalKey, OrderId: input.orderId };
    const checked = await this.requestAcquiring(
      "/v2/CheckOrder",
      {
        ...checkRequest,
        Token: this.createToken(checkRequest),
      },
      false,
    );
    // CheckOrder returns the order's payment history, without pagination.
    // https://developer.tbank.ru/schemas/eacq/openapi.yaml
    if (
      !isRecord(checked) ||
      checked.Success !== true ||
      checked.ErrorCode !== "0"
    )
      return { reason: "provider_error" };
    if (!isSuccessfulOrderResponse(checked, terminalKey, input.orderId))
      return { reason: "identity_mismatch" };
    if (!Array.isArray(checked.Payments)) return { reason: "provider_error" };
    if (checked.Payments.length === 0) return { reason: "payment_not_found" };
    const paymentIds = new Set<string>();
    const payments: CheckedPayment[] = [];
    for (const payment of checked.Payments) {
      if (
        !isRecord(payment) ||
        !isPaymentId(payment.PaymentId) ||
        // The schema declares a string here but its example uses a boolean.
        (payment.Success !== true && payment.Success !== "true") ||
        (payment.ErrorCode !== undefined &&
          payment.ErrorCode !== "0" &&
          payment.ErrorCode !== 0) ||
        typeof payment.Status !== "string" ||
        !payment.Status
      )
        return { reason: "provider_error" };
      if (paymentIds.has(payment.PaymentId))
        return { reason: "payment_ambiguous" };
      if (
        !Number.isSafeInteger(payment.Amount) ||
        payment.Amount !== input.amountKopecks
      )
        return { reason: "amount_mismatch" };
      paymentIds.add(payment.PaymentId);
      payments.push({ paymentId: payment.PaymentId, status: payment.Status });
    }
    return { payments };
  }

  private getPaymentState(paymentId: string, terminalKey: string) {
    const stateRequest = {
      TerminalKey: terminalKey,
      PaymentId: paymentId,
    };
    return this.requestAcquiring(
      "/v2/GetState",
      {
        ...stateRequest,
        Token: this.createToken(stateRequest),
      },
      false,
    );
  }

  async createCheckoutPayment(
    input: TBankAcquiringCreateCheckoutPaymentInput,
  ): Promise<TBankAcquiringCreateCheckoutPaymentResult> {
    const amount = this.createAmountKopecks(input.amount);
    const receiptItems = this.createReceiptItems(input);
    const receiptAmount = this.getReceiptItemsAmount(receiptItems);

    if (amount !== receiptAmount) {
      throw new BadRequestException({
        message: "T-Bank receipt amount must match order total",
        orderAmount: amount,
        receiptAmount,
      });
    }

    const requestWithoutToken = {
      Amount: amount,
      DATA: this.createData(input),
      Description: this.createDescription(input.orderId),
      FailURL: input.failUrl,
      Language: "ru" as const,
      NotificationURL: input.notificationUrl,
      OrderId: input.orderId,
      PayType: this.getPayType(),
      Receipt: {
        Email: input.customer.email,
        Items: receiptItems,
        Payments: {
          Electronic: amount,
        },
        ...(input.customer.phone ? { Phone: input.customer.phone } : {}),
        Taxation: this.getTaxation(),
      },
      SuccessURL: input.successUrl,
      TerminalKey: this.getTerminalKey(),
    };
    const requestBody: TBankInitRequest = {
      ...requestWithoutToken,
      Token: this.createToken(requestWithoutToken),
    };
    const responseBody = await this.requestAcquiring("/v2/Init", requestBody);
    const redirectUrl = this.getStringProperty(responseBody, "PaymentURL");

    if (!redirectUrl) {
      this.logger.warn(
        `T-Bank Acquiring /v2/Init response does not contain PaymentURL: ${this.toLogString(
          this.sanitizeForDiagnostics(responseBody),
        )}`,
      );
      throw this.createPublicBadGatewayException(checkoutPaymentErrorMessage, {
        body: this.sanitizeForDiagnostics(responseBody),
      });
    }

    return {
      acquiringOrderId: this.getStringProperty(responseBody, "OrderId"),
      paymentId: this.getNumberOrStringProperty(responseBody, "PaymentId"),
      redirectUrl,
    };
  }

  assertValidNotification(notification: TBankAcquiringPaymentNotification) {
    const token = this.getStringProperty(notification, "Token");

    if (!token) {
      throw new UnauthorizedException(
        "T-Bank Acquiring notification token is missing",
      );
    }

    const expectedToken = this.createToken(notification);

    if (!this.isSafeEqual(expectedToken, token)) {
      throw new UnauthorizedException(
        "T-Bank Acquiring notification token is invalid",
      );
    }
    const terminalKey = this.getStringProperty(notification, "TerminalKey");
    if (!terminalKey || terminalKey !== this.getTerminalKey()) {
      throw new UnauthorizedException(
        "T-Bank Acquiring notification terminal is invalid",
      );
    }
  }

  parseNotification(
    notification: TBankAcquiringPaymentNotification,
  ): TBankAcquiringParsedNotification {
    const status = this.getStringProperty(notification, "Status");

    return {
      amount: this.getNumberOrStringProperty(notification, "Amount"),
      errorCode: this.getNumberOrStringProperty(notification, "ErrorCode"),
      errorMessage:
        this.getStringProperty(notification, "Message") ??
        this.getStringProperty(notification, "Details"),
      orderId: this.getStringProperty(notification, "OrderId"),
      paymentId: this.getNumberOrStringProperty(notification, "PaymentId"),
      rawStatus: status,
      status: this.mapPaymentStatus(status),
      success: this.getBooleanProperty(notification, "Success"),
      terminalKey: this.getStringProperty(notification, "TerminalKey"),
    };
  }

  private mapPaymentStatus(status: string | undefined) {
    if (!status) {
      return undefined;
    }

    if (successfulPaymentStatuses.has(status)) {
      return "paid";
    }

    if (failedPaymentStatuses.has(status)) {
      return "failed";
    }

    return "pending";
  }

  private createReceiptItems(
    input: TBankAcquiringCreateCheckoutPaymentInput,
  ): TBankReceiptItem[] {
    if (
      input.receiptPricing &&
      (input.receiptPricing.length !== input.items.length ||
        new Set(input.receiptPricing.map((item) => item.id)).size !==
          input.receiptPricing.length)
    ) {
      throw new BadRequestException(
        "T-Bank receipt pricing does not match order items",
      );
    }
    const items: TBankReceiptItem[] = input.items.flatMap((item) => {
      const pricing = input.receiptPricing?.find(
        (candidate) => candidate.id === item.id,
      );
      const groups = pricing?.priceGroups ?? [
        {
          quantity: item.quantity,
          totalKopecks: this.createAmountKopecks(item.price) * item.quantity,
          unitPriceKopecks: this.createAmountKopecks(item.price),
        },
      ];
      if (input.receiptPricing && !pricing) {
        throw new BadRequestException(
          "T-Bank receipt pricing is missing an order item",
        );
      }
      if (
        groups.reduce((sum, group) => sum + group.quantity, 0) !== item.quantity
      ) {
        throw new BadRequestException(
          "T-Bank receipt pricing quantity must match order item",
        );
      }
      return groups.map((group) => ({
        Amount: group.totalKopecks,
        Name: this.truncate(item.title, 128),
        PaymentMethod: "full_prepayment" as const,
        PaymentObject: "commodity" as const,
        Price: group.unitPriceKopecks,
        Quantity: group.quantity,
        Tax: this.getTax(),
      }));
    });

    if (input.deliveryPrice > 0) {
      const deliveryPrice = this.createAmountKopecks(input.deliveryPrice);

      items.push({
        Amount: deliveryPrice,
        Name: this.truncate(
          this.getDeliveryItemName(input.deliveryProvider),
          128,
        ),
        PaymentMethod: "full_prepayment",
        PaymentObject: "service",
        Price: deliveryPrice,
        Quantity: 1,
        Tax: this.getTax(),
      });
    }

    if (items.length > 100) {
      throw new BadRequestException(
        "T-Bank receipt cannot contain more than 100 items",
      );
    }
    return items;
  }

  private getReceiptItemsAmount(items: TBankReceiptItem[]) {
    return items.reduce((total, item) => total + item.Amount, 0);
  }

  private createData(input: TBankAcquiringCreateCheckoutPaymentInput) {
    return {
      Email: this.truncate(input.customer.email, 100),
      ...(input.customer.phone
        ? { Phone: this.truncate(input.customer.phone, 100) }
        : {}),
      order_id: this.truncate(input.orderId, 100),
    };
  }

  private createDescription(orderId: string) {
    return this.truncate(`Заказ Artmate ${orderId}`, 140);
  }

  private getDeliveryItemName(provider: OrderDeliveryDTO["provider"]) {
    return provider === "cdek" ? "Доставка CDEK" : "Доставка Ozon";
  }

  private createAmountKopecks(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException("Payment amount must be greater than zero");
    }

    return Math.round(value * 100);
  }

  private createToken(payload: Record<string, unknown>) {
    const values = Object.entries(payload)
      .filter(([key, value]) => key !== "Token" && this.isTokenScalar(value))
      .concat([["Password", this.getPassword()]])
      .sort(([leftKey], [rightKey]) =>
        leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0,
      )
      .map(([, value]) => String(value))
      .join("");

    return crypto.createHash("sha256").update(values, "utf8").digest("hex");
  }

  private isTokenScalar(value: unknown) {
    return value !== null && value !== undefined && typeof value !== "object";
  }

  private async requestAcquiring(
    path: string,
    body: unknown,
    rejectUnsuccessful = true,
  ) {
    let response: Response;
    let responseBody: unknown;

    try {
      response = await fetch(`${this.getBaseUrl()}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        ...(!rejectUnsuccessful ? { signal: AbortSignal.timeout(8_000) } : {}),
      });
      responseBody = await this.parseResponseBody(response);
    } catch (error) {
      const diagnostic =
        error instanceof Error
          ? { message: error.message, name: error.name }
          : error;
      this.logger.warn(
        `T-Bank Acquiring ${path} transport failed: ${this.toLogString(diagnostic)}`,
      );
      throw this.createPublicBadGatewayException(
        checkoutPaymentErrorMessage,
        diagnostic,
      );
    }

    if (
      !response.ok ||
      (rejectUnsuccessful && this.isRejectedResponse(responseBody))
    ) {
      const diagnosticBody = this.sanitizeForDiagnostics(responseBody);
      this.logger.warn(
        `T-Bank Acquiring ${path} failed with status ${
          response.status
        }: ${this.toLogString(diagnosticBody)}`,
      );

      throw this.createPublicBadGatewayException(checkoutPaymentErrorMessage, {
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

  private isRejectedResponse(value: unknown) {
    if (!value || typeof value !== "object") {
      return false;
    }

    const success = this.getBooleanProperty(value, "Success");

    return success === false;
  }

  private async parseResponseBody(response: Response) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return (await response.json()) as unknown;
    }

    return response.text();
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

  private getBooleanProperty(value: unknown, property: string) {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const propertyValue = (value as Record<string, unknown>)[property];

    if (typeof propertyValue === "boolean") {
      return propertyValue;
    }

    if (typeof propertyValue === "string") {
      if (propertyValue.toLowerCase() === "true") {
        return true;
      }

      if (propertyValue.toLowerCase() === "false") {
        return false;
      }
    }

    return undefined;
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

    const errorCode = this.getNumberOrStringProperty(value, "ErrorCode");
    const message = this.getStringProperty(value, "Message");
    const details = this.getStringProperty(value, "Details");

    return [errorCode ? `ErrorCode=${errorCode}` : undefined, message, details]
      .filter((item): item is string => Boolean(item))
      .join("; ");
  }

  private sanitizeForDiagnostics(value: unknown): unknown {
    if (!value || typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeForDiagnostics(item));
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, propertyValue]) => [
        key,
        this.isSensitiveKey(key)
          ? "[redacted]"
          : this.sanitizeForDiagnostics(propertyValue),
      ]),
    );
  }

  private isSensitiveKey(key: string) {
    return ["Password", "Token"].includes(key);
  }

  private isSafeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      crypto.timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  private toLogString(value: unknown) {
    if (typeof value === "string") {
      return this.truncate(value, 1000);
    }

    try {
      return this.truncate(JSON.stringify(value), 1000);
    } catch {
      return "[unserializable]";
    }
  }

  private getBaseUrl() {
    return (
      this.getOptionalString(process.env.TBANK_ACQUIRING_BASE_URL) ??
      defaultAcquiringBaseUrl
    ).replace(/\/+$/, "");
  }

  private getTerminalKey() {
    return this.getRequiredEnv("TBANK_ACQUIRING_TERMINAL_KEY");
  }

  private getPassword() {
    return this.getRequiredEnv("TBANK_ACQUIRING_PASSWORD");
  }

  private getPayType(): TBankAcquiringPayType {
    const value =
      this.getOptionalString(process.env.TBANK_ACQUIRING_PAY_TYPE) ?? "O";

    if (value === "O" || value === "T") {
      return value;
    }

    throw new InternalServerErrorException(
      "TBANK_ACQUIRING_PAY_TYPE must be O or T",
    );
  }

  private getTaxation(): TBankReceiptTaxation {
    const value = this.getRequiredEnv("TBANK_ACQUIRING_TAXATION");

    if (
      value === "osn" ||
      value === "usn_income" ||
      value === "usn_income_outcome" ||
      value === "esn" ||
      value === "patent"
    ) {
      return value;
    }

    throw new InternalServerErrorException(
      "TBANK_ACQUIRING_TAXATION is invalid",
    );
  }

  private getTax(): TBankReceiptTax {
    const value = this.getRequiredEnv("TBANK_ACQUIRING_TAX");

    if (
      value === "none" ||
      value === "vat0" ||
      value === "vat5" ||
      value === "vat7" ||
      value === "vat10" ||
      value === "vat20" ||
      value === "vat22" ||
      value === "vat105" ||
      value === "vat107" ||
      value === "vat110" ||
      value === "vat120" ||
      value === "vat122"
    ) {
      return value;
    }

    throw new InternalServerErrorException("TBANK_ACQUIRING_TAX is invalid");
  }

  private getRequiredEnv(name: string) {
    const value = this.getOptionalString(process.env[name]);

    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }

    return value;
  }

  private getOptionalString(value: string | undefined) {
    return value?.trim() || undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSuccessfulOrderResponse(
  value: unknown,
  terminalKey: string,
  orderId: string,
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.Success === true &&
    value.ErrorCode === "0" &&
    value.TerminalKey === terminalKey &&
    value.OrderId === orderId
  );
}

function isClosedUnpaidStatus(value: unknown) {
  return value === "CANCELED" || value === "DEADLINE_EXPIRED";
}

function isPaymentId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 20 &&
    value.trim() === value
  );
}

function assertReconciliationInput(input: TBankAcquiringReconciliationInput) {
  if (
    !input ||
    typeof input.orderId !== "string" ||
    !input.orderId ||
    input.orderId.trim() !== input.orderId ||
    input.orderId.length > 50 ||
    (input.paymentId !== undefined && !isPaymentId(input.paymentId)) ||
    !Number.isSafeInteger(input.amountKopecks) ||
    input.amountKopecks <= 0
  )
    throw new BadRequestException("Invalid T-Bank reconciliation identity");
}

function isMatchingPaymentState(
  state: unknown,
  terminalKey: string,
  input: TBankAcquiringReconciliationInput,
  paymentId: string,
): state is Record<string, unknown> {
  return (
    paymentStateProblem(state, terminalKey, input, paymentId) === undefined
  );
}

function paymentStateProblem(
  state: unknown,
  terminalKey: string,
  input: TBankAcquiringReconciliationInput,
  paymentId: string,
): string | undefined {
  if (
    !isRecord(state) ||
    state.Success !== true ||
    state.ErrorCode !== "0" ||
    typeof state.Status !== "string"
  )
    return "provider_error";
  if (
    state.TerminalKey !== terminalKey ||
    state.OrderId !== input.orderId ||
    state.PaymentId !== paymentId
  )
    return "identity_mismatch";
  if (
    !Number.isSafeInteger(state.Amount) ||
    state.Amount !== input.amountKopecks
  )
    return "amount_mismatch";
  return undefined;
}
