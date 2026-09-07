import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";

import { Prisma } from "../generated/prisma/client";
import type { OzonOAuthToken as PrismaOzonOAuthToken } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import {
  OZON_OAUTH_AUTHORIZE_URL,
  OZON_OAUTH_TOKEN_KEY,
  OZON_OAUTH_TOKEN_URL,
  OZON_SELLER_API_URL,
  OZON_TOKEN_EXPIRY_SAFETY_MS,
  ozonSellerApiRequestTimeoutMs,
} from "./ozon.constants";
import type {
  OzonOAuthAccessType,
  OzonOAuthTokenResponse,
  OzonStoredOAuthToken,
  OzonTokenStatus,
} from "./ozon.types";

@Injectable()
export class OzonOAuthService {
  private storedToken: OzonStoredOAuthToken | undefined;

  constructor(private readonly prisma: PrismaService) {}

  createState() {
    return crypto.randomBytes(32).toString("base64url");
  }

  getAuthorizationUrl(state: string, scopeOverride?: string) {
    const scope = this.getScope(scopeOverride);
    const url = new URL(OZON_OAUTH_AUTHORIZE_URL);

    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", this.getAccessType());
    url.searchParams.set("client_id", this.getClientId());
    url.searchParams.set("redirect_uri", this.getRedirectUri());
    url.searchParams.set("scope", scope);
    url.searchParams.set("state", state);

    if (process.env.OZON_OAUTH_PROMPT !== "none") {
      url.searchParams.set("prompt", "select_company");
    }

    return url.toString().replaceAll("+", "%20");
  }

  getRedirectUri() {
    return (
      process.env.OZON_OAUTH_REDIRECT_URI ??
      `${this.getApiPublicUrl()}/ozon/oauth/callback`
    );
  }

  async exchangeCode(code: string) {
    const token = await this.requestToken({
      grant_type: "authorization_code",
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      redirect_uri: this.getRedirectUri(),
      code,
    });

    await this.saveToken(token);

    return this.getTokenStatus();
  }

  async refreshAccessToken(
    refreshTokenOverride?: string,
    signal?: AbortSignal,
  ) {
    const storedToken = this.storedToken ?? (await this.getStoredToken());
    const refreshToken =
      this.getOptionalString(refreshTokenOverride) ??
      storedToken?.refreshToken ??
      this.getOptionalString(process.env.OZON_OAUTH_REFRESH_TOKEN);

    if (!refreshToken) {
      throw new UnauthorizedException(
        "Ozon OAuth refresh token is missing. Authorize through /ozon/oauth first or set OZON_OAUTH_REFRESH_TOKEN",
      );
    }

    const token = await this.requestToken(
      {
        grant_type: "refresh_token",
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        refresh_token: refreshToken,
      },
      signal,
    );

    if (!token.refreshToken) {
      token.refreshToken = refreshToken;
    }

    await this.saveToken(token);

    return this.getTokenStatus();
  }

  async getAccessToken(signal?: AbortSignal) {
    const token = this.storedToken ?? (await this.getStoredToken());

    if (token && this.hasValidAccessToken(token)) {
      this.storedToken = token;
      return token.accessToken;
    }

    await this.refreshAccessToken(undefined, signal);

    if (!this.storedToken) {
      throw new UnauthorizedException("Ozon OAuth token is missing");
    }

    return this.storedToken.accessToken;
  }

  async requestSellerApi(path: string, body: unknown = {}) {
    const signal = AbortSignal.timeout(ozonSellerApiRequestTimeoutMs);
    const accessToken = await this.getAccessToken(signal);
    let response: Response;

    try {
      response = await fetch(`${this.getSellerApiUrl()}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      throw this.createSellerApiTransportException(error, signal);
    }

    let responseBody: unknown;

    try {
      responseBody = await this.parseResponseBody(response);
    } catch (error) {
      throw this.createSellerApiTransportException(error, signal);
    }

    if (!response.ok) {
      const errorResponse = {
        message: "Ozon Seller API request failed",
        status: response.status,
        body: responseBody,
      };

      if (response.status >= 400 && response.status < 500) {
        throw new HttpException(errorResponse, response.status);
      }

      throw new BadGatewayException(errorResponse);
    }

    return responseBody;
  }

  async getTokenStatus(): Promise<OzonTokenStatus> {
    const token = await this.getStoredToken();

    return {
      configured: this.isConfigured(),
      hasAccessToken: Boolean(token?.accessToken),
      hasRefreshToken: Boolean(
        token?.refreshToken ??
        this.getOptionalString(process.env.OZON_OAUTH_REFRESH_TOKEN),
      ),
      persisted: Boolean(token),
      expiresAt: token ? new Date(token.expiresAt).toISOString() : undefined,
      updatedAt: token?.updatedAt
        ? new Date(token.updatedAt).toISOString()
        : undefined,
      scope: token?.scope ?? [],
      tokenType: token?.tokenType,
    };
  }

  private async requestToken(
    body: Record<string, string>,
    signal = AbortSignal.timeout(ozonSellerApiRequestTimeoutMs),
  ): Promise<OzonStoredOAuthToken> {
    let response: Response;
    let responseBody: unknown;

    try {
      response = await fetch(OZON_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
      responseBody = await this.parseResponseBody(response);
    } catch (error) {
      throw this.createOAuthTokenTransportException(error, signal);
    }

    if (!response.ok) {
      throw new BadGatewayException({
        message: "Ozon OAuth token request failed",
        status: response.status,
        body: responseBody,
      });
    }

    return this.mapTokenResponse(responseBody);
  }

  private mapTokenResponse(responseBody: unknown): OzonStoredOAuthToken {
    if (
      !responseBody ||
      typeof responseBody !== "object" ||
      Array.isArray(responseBody)
    ) {
      throw new BadGatewayException({
        message: "Ozon OAuth token response is invalid",
        bodyShape: this.getSafeTokenResponseShape(responseBody),
      });
    }

    const token = responseBody as OzonOAuthTokenResponse;
    const accessToken = this.getOptionalString(token.access_token);
    const expiresIn = this.getExpiresIn(token.expires_in);
    const expiresAt = accessToken
      ? this.getTokenExpiresAt(accessToken, expiresIn)
      : undefined;

    if (
      !accessToken ||
      typeof expiresAt !== "number" ||
      !Number.isFinite(expiresAt) ||
      !Number.isFinite(new Date(expiresAt).getTime()) ||
      expiresAt <= Date.now()
    ) {
      throw new BadGatewayException({
        message: "Ozon OAuth token response is invalid",
        bodyShape: this.getSafeTokenResponseShape(responseBody),
      });
    }

    return {
      accessToken,
      expiresAt,
      refreshToken: this.getOptionalString(token.refresh_token),
      scope: this.getScopeList(token.scope),
      tokenType: this.getOptionalString(token.token_type),
    };
  }

  private async parseResponseBody(response: Response) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return (await response.json()) as unknown;
    }

    return response.text();
  }

  private hasValidAccessToken(token: OzonStoredOAuthToken) {
    return Boolean(
      token.accessToken &&
      token.expiresAt - OZON_TOKEN_EXPIRY_SAFETY_MS > Date.now(),
    );
  }

  private async getStoredToken() {
    const token = await this.getOzonOAuthTokenDelegate().ozonOAuthToken.findUnique(
      {
        where: {
          tokenKey: OZON_OAUTH_TOKEN_KEY,
        },
      },
    );

    if (!token) {
      this.storedToken = undefined;

      return undefined;
    }

    this.storedToken = this.mapPrismaToken(token);

    return this.storedToken;
  }

  private async saveToken(token: OzonStoredOAuthToken) {
    const savedToken = await this.getOzonOAuthTokenDelegate().ozonOAuthToken.upsert(
      {
        where: {
          tokenKey: OZON_OAUTH_TOKEN_KEY,
        },
        create: {
          tokenKey: OZON_OAUTH_TOKEN_KEY,
          accessToken: token.accessToken,
          refreshToken: token.refreshToken ?? null,
          scope: token.scope,
          tokenType: token.tokenType ?? null,
          expiresAt: new Date(token.expiresAt),
        },
        update: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken ?? null,
          scope: token.scope,
          tokenType: token.tokenType ?? null,
          expiresAt: new Date(token.expiresAt),
        },
      },
    );

    this.storedToken = this.mapPrismaToken(savedToken);

    return this.storedToken;
  }

  private mapPrismaToken(token: PrismaOzonOAuthToken): OzonStoredOAuthToken {
    return {
      accessToken: token.accessToken,
      expiresAt:
        this.getJwtExpiresAt(token.accessToken) ?? token.expiresAt.getTime(),
      refreshToken: this.getOptionalString(token.refreshToken),
      scope: token.scope,
      tokenType: this.getOptionalString(token.tokenType),
      updatedAt: token.updatedAt.getTime(),
    };
  }

  private getOzonOAuthTokenDelegate() {
    return this.prisma as PrismaService & {
      ozonOAuthToken: Prisma.OzonOAuthTokenDelegate;
    };
  }

  private getScope(scopeOverride?: string) {
    const scope =
      this.getOptionalString(scopeOverride) ??
      this.getOptionalString(process.env.OZON_OAUTH_SCOPE);

    if (!scope) {
      throw new InternalServerErrorException(
        "OZON_OAUTH_SCOPE is not configured",
      );
    }

    return scope;
  }

  private getAccessType(): OzonOAuthAccessType {
    return process.env.OZON_OAUTH_ACCESS_TYPE === "online"
      ? "online"
      : "offline";
  }

  private getScopeList(scope: unknown) {
    if (Array.isArray(scope)) {
      return scope.filter((item): item is string => typeof item === "string");
    }

    if (typeof scope === "string") {
      return scope.split(/\s+/).filter(Boolean);
    }

    return [];
  }

  private getExpiresIn(expiresIn: unknown) {
    if (typeof expiresIn === "number" && Number.isFinite(expiresIn)) {
      return expiresIn;
    }

    if (typeof expiresIn === "string") {
      const parsedExpiresIn = Number(expiresIn);

      return Number.isFinite(parsedExpiresIn) ? parsedExpiresIn : undefined;
    }

    return undefined;
  }

  private getTokenExpiresAt(
    accessToken: string,
    expiresIn: number | undefined,
  ) {
    const jwtExpiresAt = this.getJwtExpiresAt(accessToken);

    if (jwtExpiresAt !== undefined) {
      return jwtExpiresAt;
    }

    if (this.getJwtExpiresAtSeconds(accessToken) !== undefined) {
      return undefined;
    }

    if (!expiresIn || expiresIn <= 0) {
      return undefined;
    }

    if (expiresIn >= 1_000_000_000_000) {
      return expiresIn;
    }

    if (expiresIn >= 1_000_000_000) {
      return expiresIn * 1000;
    }

    return Date.now() + expiresIn * 1000;
  }

  private getJwtExpiresAt(accessToken: string) {
    const expiresAtSeconds = this.getJwtExpiresAtSeconds(accessToken);

    if (expiresAtSeconds === undefined) {
      return undefined;
    }

    const expiresAt = expiresAtSeconds * 1000;

    return Number.isFinite(expiresAt) &&
      Number.isFinite(new Date(expiresAt).getTime())
      ? expiresAt
      : undefined;
  }

  private getJwtExpiresAtSeconds(accessToken: string) {
    const parts = accessToken.split(".");

    if (parts.length !== 3 || !parts[1]) {
      return undefined;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8"),
      ) as unknown;

      if (!payload || typeof payload !== "object") {
        return undefined;
      }

      const expiresAtSeconds = (payload as Record<string, unknown>).exp;

      return typeof expiresAtSeconds === "number" &&
        Number.isFinite(expiresAtSeconds) &&
        expiresAtSeconds > 0
        ? expiresAtSeconds
        : undefined;
    } catch {
      return undefined;
    }
  }

  private createSellerApiTransportException(
    error: unknown,
    signal: AbortSignal,
  ) {
    const errorName =
      error && typeof error === "object" && "name" in error
        ? error.name
        : undefined;

    if (
      signal.aborted ||
      errorName === "TimeoutError" ||
      errorName === "AbortError"
    ) {
      return new GatewayTimeoutException({
        message: "Ozon Seller API request timed out",
      });
    }

    return new BadGatewayException({
      message: "Ozon Seller API request failed",
    });
  }

  private createOAuthTokenTransportException(
    error: unknown,
    signal: AbortSignal,
  ) {
    const errorName =
      error && typeof error === "object" && "name" in error
        ? error.name
        : undefined;

    if (
      signal.aborted ||
      errorName === "TimeoutError" ||
      errorName === "AbortError"
    ) {
      return new GatewayTimeoutException({
        message: "Ozon OAuth token request timed out",
      });
    }

    return new BadGatewayException({
      message: "Ozon OAuth token request failed",
    });
  }

  private getSafeTokenResponseShape(responseBody: unknown) {
    if (!responseBody || typeof responseBody !== "object") {
      return typeof responseBody;
    }

    return Object.fromEntries(
      Object.entries(responseBody).map(([key, value]) => [
        key,
        key.includes("token") || key === "access_token" ? typeof value : value,
      ]),
    );
  }

  private getSellerApiUrl() {
    return (process.env.OZON_API ?? OZON_SELLER_API_URL).replace(/\/+$/, "");
  }

  private getClientId() {
    return this.getRequiredEnv("OZON_OAUTH_CLIENT_ID");
  }

  private getClientSecret() {
    return this.getRequiredEnv("OZON_OAUTH_CLIENT_SECRET");
  }

  private getApiPublicUrl() {
    return (process.env.API_PUBLIC_URL ?? "http://localhost:3002").replace(
      /\/+$/,
      "",
    );
  }

  private getRequiredEnv(name: string) {
    const value = process.env[name];

    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }

    return value;
  }

  private getOptionalString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : undefined;
  }

  private isConfigured() {
    return Boolean(
      this.getOptionalString(process.env.OZON_OAUTH_CLIENT_ID) &&
      this.getOptionalString(process.env.OZON_OAUTH_CLIENT_SECRET),
    );
  }
}
