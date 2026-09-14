import { Injectable } from "@nestjs/common";

export type YandexOrderConversionPayload = Readonly<{
  clientId?: string;
  yclid?: string;
  purchaseId: string;
  target: "order_created" | "order_paid";
  dateTime: number;
  price: string;
  currency: "RUB";
}>;

export type YandexUploadingStatus =
  | "PREPARED"
  | "UPLOADED"
  | "EXPORTED"
  | "MATCHED"
  | "PROCESSED"
  | "LINKAGE_FAILURE"
  | "UNKNOWN";

export type YandexUploading = Readonly<{
  comment: string;
  id: string;
  status: YandexUploadingStatus;
  createTime?: string;
  sourceQuantity?: number;
  lineQuantity?: number;
  linkedQuantity?: number;
  verificationError?: string;
  providerResponse: string;
}>;

type BeforeRequest = () => Promise<void>;

const uploadTimeoutMs = 10_000;
const uploadingsPageSize = 1_000;
const maxUploadingsPages = 100;
const uploadingStatuses = new Set<string>([
  "PREPARED",
  "UPLOADED",
  "EXPORTED",
  "MATCHED",
  "PROCESSED",
  "LINKAGE_FAILURE",
]);

@Injectable()
export class YandexOfflineConversionsService {
  async upload(
    payload: YandexOrderConversionPayload,
    comment: string,
    beforeRequest?: BeforeRequest,
  ) {
    this.assertComment(comment);
    const csv = [
      "ClientId,Yclid,PurchaseId,Target,DateTime,Price,Currency",
      [
        payload.clientId ?? "",
        payload.yclid ?? "",
        payload.purchaseId,
        payload.target,
        payload.dateTime,
        payload.price,
        payload.currency,
      ]
        .map((value) => this.escapeCsv(String(value)))
        .join(","),
      "",
    ].join("\r\n");
    const form = new FormData();
    form.set(
      "file",
      new File([csv], "offline-conversions.csv", { type: "text/csv" }),
    );
    const query = new URLSearchParams({ comment, type: "BASIC" });
    const response = await this.request(
      `upload?${query}`,
      {
        method: "POST",
        body: form,
      },
      beforeRequest,
    );
    const uploading = this.parseSingleUploading(response.body);

    if (uploading.comment !== comment) {
      throw new Error("Yandex upload response comment does not match request");
    }

    return uploading;
  }

  async findUploadingById(id: string, beforeRequest?: BeforeRequest) {
    if (!/^[0-9]+$/.test(id)) {
      throw new Error("Yandex upload id is invalid");
    }

    const response = await this.request(
      `uploading/${encodeURIComponent(id)}`,
      {},
      beforeRequest,
    );
    const uploading = this.parseSingleUploading(response.body);
    if (uploading.id !== id) {
      throw new Error("Yandex upload response id does not match request");
    }
    return uploading;
  }

  async findUploadingByComment(comment: string, beforeRequest?: BeforeRequest) {
    this.assertComment(comment);

    for (let page = 0; page < maxUploadingsPages; page += 1) {
      const query = new URLSearchParams({
        limit: String(uploadingsPageSize),
        offset: String(page * uploadingsPageSize),
        type: "BASIC",
      });
      const response = await this.request(
        `uploadings?${query}`,
        {},
        beforeRequest,
      );
      const uploadings = this.parseUploadings(response.body);
      const match = uploadings.find(
        (uploading) => uploading.comment === comment,
      );

      if (match) {
        return match;
      }
      if (uploadings.length < uploadingsPageSize) {
        return null;
      }
    }

    throw new Error("Yandex uploadings pagination limit exceeded");
  }

  private async request(
    path: string,
    init: RequestInit = {},
    beforeRequest?: BeforeRequest,
  ) {
    const counterId = this.getRequiredEnv("YANDEX_METRIKA_ID");
    const token = this.getRequiredEnv("YANDEX_METRIKA_OAUTH_TOKEN");
    await beforeRequest?.();
    const response = await fetch(
      `https://api-metrika.yandex.net/management/v1/counter/${encodeURIComponent(counterId)}/offline_conversions/${path}`,
      {
        ...init,
        headers: { Authorization: `OAuth ${token}` },
        signal: AbortSignal.timeout(uploadTimeoutMs),
      },
    );
    const text = await response.text();
    if (!response.ok) {
      throw new YandexOfflineConversionsHttpError(response.status, text);
    }

    try {
      return { body: JSON.parse(text) as unknown };
    } catch {
      throw new Error("Yandex offline conversions response is not valid JSON");
    }
  }

  private parseSingleUploading(body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Yandex upload response is invalid");
    }
    return this.parseUploading((body as Record<string, unknown>).uploading);
  }

  private parseUploadings(body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Yandex uploadings response is invalid");
    }
    const uploadings = (body as Record<string, unknown>).uploadings;
    if (!Array.isArray(uploadings)) {
      throw new Error("Yandex uploadings response is invalid");
    }
    return uploadings.map((uploading) => this.parseUploading(uploading));
  }

  private parseUploading(value: unknown): YandexUploading {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Yandex upload response is invalid");
    }
    const uploading = value as Record<string, unknown>;
    const id =
      typeof uploading.id === "number" &&
      Number.isSafeInteger(uploading.id) &&
      uploading.id > 0
        ? String(uploading.id)
        : undefined;
    if (!id || typeof uploading.comment !== "string") {
      throw new Error("Yandex upload response is invalid");
    }
    let verificationError: string | undefined;
    let status: YandexUploadingStatus = "UNKNOWN";
    if (
      typeof uploading.status === "string" &&
      uploadingStatuses.has(uploading.status)
    ) {
      status = uploading.status as YandexUploadingStatus;
    } else {
      verificationError = "Yandex upload status is missing or unsupported";
    }

    const quantities: {
      sourceQuantity?: number;
      lineQuantity?: number;
      linkedQuantity?: number;
    } = {};
    for (const [source, target] of [
      ["source_quantity", "sourceQuantity"],
      ["line_quantity", "lineQuantity"],
      ["linked_quantity", "linkedQuantity"],
    ] as const) {
      if (!(source in uploading)) continue;
      const quantity = uploading[source];
      if (
        typeof quantity !== "number" ||
        !Number.isSafeInteger(quantity) ||
        quantity < 0
      ) {
        verificationError = "Yandex upload quantity is invalid";
        continue;
      }
      quantities[target] = quantity;
    }
    if (
      quantities.sourceQuantity !== undefined &&
      quantities.lineQuantity !== undefined &&
      quantities.lineQuantity > quantities.sourceQuantity
    ) {
      verificationError = "Yandex upload quantities are inconsistent";
    }

    let createTime: string | undefined;
    if ("create_time" in uploading) {
      const value = uploading.create_time;
      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
          value,
        ) &&
        Number.isFinite(Date.parse(value))
      ) {
        createTime = new Date(value).toISOString();
      } else {
        verificationError = "Yandex upload creation time is invalid";
      }
    }

    // Keep a valid upload ID even when metadata is unusable: a later GET can
    // recover it, whereas throwing here could cause another POST after a crash.
    if (verificationError) status = "UNKNOWN";
    const metadata = {
      id,
      status,
      ...(createTime ? { createTime } : {}),
      ...quantities,
      ...(verificationError ? { verificationError } : {}),
    };
    return {
      comment: uploading.comment,
      ...metadata,
      providerResponse: JSON.stringify(metadata),
    };
  }

  private assertComment(comment: string) {
    if (!/^[A-Za-z0-9]{1,255}$/.test(comment)) {
      throw new Error("Yandex upload comment is invalid");
    }
  }

  private escapeCsv(value: string) {
    return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  }

  private getRequiredEnv(name: string) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is not configured`);
    return value;
  }
}

export class YandexOfflineConversionsHttpError extends Error {
  readonly providerResponse: string;

  constructor(
    readonly status: number,
    providerResponse?: string,
  ) {
    const diagnostic: { httpStatus: number; errorCount?: number } = {
      httpStatus: status,
    };
    try {
      const body: unknown = JSON.parse(providerResponse ?? "");
      if (body && typeof body === "object" && !Array.isArray(body)) {
        const errors = (body as Record<string, unknown>).errors;
        if (Array.isArray(errors)) diagnostic.errorCount = errors.length;
      }
    } catch {
      // Provider errors can echo CSV rows or credentials. Never persist raw text.
    }
    super(`Yandex offline conversion failed: status=${status}`);
    this.providerResponse = JSON.stringify(diagnostic);
  }
}
