import { Injectable } from "@nestjs/common";

export type OzonPostingState =
  | "pending"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "unknown";

function _isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

@Injectable()
export class OzonPostingClient {
  isConfigured(): boolean {
    return Boolean(
      process.env.OZON_CLIENT_ID?.trim() && process.env.OZON_API_KEY?.trim(),
    );
  }

  async getState(
    postingNumber: string,
    scheme: "fbo" | "fbs",
  ): Promise<OzonPostingState> {
    if (
      (scheme !== "fbo" && scheme !== "fbs") ||
      typeof postingNumber !== "string" ||
      postingNumber.length > 64 ||
      postingNumber.trim() !== postingNumber ||
      !/^\d+-\d+-\d+$/.test(postingNumber)
    ) {
      throw new Error("Invalid Ozon posting number");
    }

    const clientId = process.env.OZON_CLIENT_ID?.trim();
    const apiKey = process.env.OZON_API_KEY?.trim();

    if (!clientId || !apiKey) {
      throw new Error("Ozon posting tracking is not configured");
    }

    try {
      const response = await fetch(
        scheme === "fbs"
          ? "https://api-seller.ozon.ru/v3/posting/fbs/get"
          : "https://api-seller.ozon.ru/v2/posting/fbo/get",
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(8_000),
          headers: {
            "Content-Type": "application/json",
            "Client-Id": clientId,
            "Api-Key": apiKey,
          },
          body: JSON.stringify({ posting_number: postingNumber }),
        },
      );

      if (!response.ok) {
        throw new Error("Unsuccessful response");
      }

      const body: unknown = await response.json();

      if (
        !_isRecord(body) ||
        !_isRecord(body.result) ||
        body.result.posting_number !== postingNumber ||
        typeof body.result.status !== "string"
      ) {
        throw new Error("Invalid response");
      }

      switch (body.result.status) {
        case "awaiting_packaging":
        case "awaiting_deliver":
          return "pending";
        case "delivering":
          return "in_transit";
        case "delivered":
          return "delivered";
        case "cancelled":
          return "cancelled";
        default:
          return "unknown";
      }
    } catch {
      // Upstream errors may include credentials, addresses or response bodies.
      throw new Error("Unable to check Ozon posting status");
    }
  }
}
