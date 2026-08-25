import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";

import { CdekClientService } from "./cdek-client.service";
import type {
  CdekWebhookMutationResponse,
  CdekWebhookResponseItem,
} from "./cdek.types";

const cdekOrderStatusWebhookType = "ORDER_STATUS";
const cdekWebhookLimit = 2;

type ActiveCdekWebhook = {
  type: string;
  url: string;
  uuid: string;
};

@Injectable()
export class CdekWebhookService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CdekWebhookService.name);

  constructor(private readonly cdekClient: CdekClientService) {}

  onApplicationBootstrap(): void {
    if (process.env.CDEK_WEBHOOK_AUTO_REGISTER_ENABLED !== "true") {
      return;
    }

    void this.reconcileOrderStatusWebhook().catch((error) => {
      this.logger.error(
        `Failed to reconcile CDEK ORDER_STATUS webhook: ${this.getErrorMessage(error)}`,
      );
    });
  }

  async reconcileOrderStatusWebhook(): Promise<void> {
    const expectedUrl = this.getExpectedUrl();
    const webhooks = await this.getWebhooks();
    const exact = webhooks.find(
      (webhook) =>
        webhook.type === cdekOrderStatusWebhookType &&
        webhook.url === expectedUrl,
    );

    if (exact) {
      return;
    }

    if (webhooks.length >= cdekWebhookLimit) {
      throw new Error("CDEK webhook limit is full; manual cleanup is required");
    }

    await this.cdekClient.request<CdekWebhookMutationResponse>("/v2/webhooks", {
      method: "POST",
      body: { type: cdekOrderStatusWebhookType, url: expectedUrl },
    });

    const confirmedWebhooks = await this.getWebhooks();
    const confirmed = confirmedWebhooks.find(
      (webhook) =>
        webhook.type === cdekOrderStatusWebhookType &&
        webhook.url === expectedUrl,
    );

    if (!confirmed) {
      throw new Error("CDEK ORDER_STATUS webhook was not confirmed");
    }
  }

  private async getWebhooks(): Promise<ActiveCdekWebhook[]> {
    const response = await this.cdekClient.request<unknown>("/v2/webhooks");

    if (!Array.isArray(response)) {
      throw new Error("CDEK webhook list response is invalid");
    }

    return response.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("CDEK webhook list response is invalid");
      }

      const webhook = value as CdekWebhookResponseItem;

      if (
        typeof webhook.type !== "string" ||
        typeof webhook.url !== "string" ||
        typeof webhook.uuid !== "string"
      ) {
        throw new Error("CDEK webhook list response is invalid");
      }

      return {
        type: webhook.type,
        url: webhook.url,
        uuid: webhook.uuid,
      };
    });
  }

  private getExpectedUrl(): string {
    const apiPublicUrl = this.getRequiredConfig("API_PUBLIC_URL").replace(
      /\/+$/,
      "",
    );
    const secret = this.getRequiredConfig("CDEK_WEBHOOK_SECRET");

    return `${apiPublicUrl}/orders/delivery/cdek/webhook/${encodeURIComponent(secret)}`;
  }

  private getRequiredConfig(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
      throw new Error(`${name} is required`);
    }

    return value;
  }

  private getErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const secret = process.env.CDEK_WEBHOOK_SECRET?.trim();

    return secret
      ? message
          .replaceAll(secret, "<redacted>")
          .replaceAll(encodeURIComponent(secret), "<redacted>")
      : message;
  }
}
