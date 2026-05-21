import {
  BadGatewayException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import type { CdekTokenResponse } from "./cdek.types";

const defaultCdekApiBaseUrl = "https://api.edu.cdek.ru";
const tokenExpirySafetyMs = 60_000;

type CdekAccessToken = {
  accessToken: string;
  expiresAt: number;
};

type CdekRequestOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
};

@Injectable()
export class CdekClientService {
  private token: CdekAccessToken | undefined;

  async request<T>(path: string, options: CdekRequestOptions = {}): Promise<T> {
    const accessToken = await this.getAccessToken();
    const url = this.getApiUrl(path, options.query);
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(options.body ? { "content-type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const responseBody = await this.parseResponseBody(response);

    if (!response.ok) {
      const errorResponse = {
        message: "CDEK API request failed",
        status: response.status,
        body: responseBody,
      };

      if (response.status >= 400 && response.status < 500) {
        throw new HttpException(errorResponse, response.status);
      }

      throw new BadGatewayException(errorResponse);
    }

    return responseBody as T;
  }

  private async getAccessToken() {
    if (this.token && this.token.expiresAt > Date.now() + tokenExpirySafetyMs) {
      return this.token.accessToken;
    }

    const token = await this.requestAccessToken();

    this.token = token;

    return token.accessToken;
  }

  private async requestAccessToken(): Promise<CdekAccessToken> {
    const body = new URLSearchParams({
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      grant_type: "client_credentials",
    });
    const response = await fetch(this.getApiUrl("/v2/oauth/token"), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const responseBody = (await this.parseResponseBody(
      response,
    )) as CdekTokenResponse;

    if (!response.ok) {
      throw new BadGatewayException({
        message: "CDEK OAuth token request failed",
        status: response.status,
        body: responseBody,
      });
    }

    if (typeof responseBody.access_token !== "string") {
      throw new BadGatewayException("CDEK OAuth token response is invalid");
    }

    return {
      accessToken: responseBody.access_token,
      expiresAt: Date.now() + this.getExpiresIn(responseBody.expires_in) * 1000,
    };
  }

  private getApiUrl(path: string, query?: CdekRequestOptions["query"]) {
    const url = new URL(`${this.getApiBaseUrl()}${path}`);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  private getApiBaseUrl() {
    return (process.env.CDEK_API_BASE_URL ?? defaultCdekApiBaseUrl).replace(
      /\/$/,
      "",
    );
  }

  private getClientId() {
    return this.getRequiredConfig("CDEK_CLIENT_ID");
  }

  private getClientSecret() {
    return this.getRequiredConfig("CDEK_CLIENT_SECRET");
  }

  private getRequiredConfig(name: string) {
    const value = process.env[name];

    if (!value?.trim()) {
      throw new InternalServerErrorException(`${name} is required`);
    }

    return value.trim();
  }

  private getExpiresIn(value: unknown) {
    const expiresIn = typeof value === "number" ? value : Number(value);

    return Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
  }

  private async parseResponseBody(response: Response) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return (await response.json()) as unknown;
    }

    return response.text();
  }
}
