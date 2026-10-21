import { UnauthorizedException } from "@nestjs/common";
import type { AuthFlowCredentials } from "./contracts/flow-response.contract";
import { FlowCredentials } from "./flow-credentials";

export const pendingCookieName = "artmate_auth_pending";
export const browserCookieName = "artmate_auth_browser";

export interface FlowCookieResponse {
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      sameSite: "lax";
      secure: boolean;
      path: string;
      maxAge: number;
    },
  ): void;
  setHeader(name: string, value: string): void;
}

export class FlowCookies {
  public static read(header?: string): AuthFlowCredentials | undefined {
    const pending = this._get(header, pendingCookieName);
    const browser = this._get(header, browserCookieName);
    if (!pending && !browser) return undefined;
    if (!pending || !browser) return undefined;
    return FlowCredentials.validate({ pending, browser });
  }
  public static require(header?: string): AuthFlowCredentials {
    const credentials = this.read(header);
    if (!credentials)
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    return credentials;
  }
  public static write(
    response: FlowCookieResponse,
    credentials: AuthFlowCredentials,
  ): void {
    const options = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 15 * 60 * 1000,
    };
    response.cookie(pendingCookieName, credentials.pending, options);
    response.cookie(browserCookieName, credentials.browser, {
      ...options,
      maxAge: 24 * 60 * 60 * 1000,
    });
    response.setHeader("Cache-Control", "no-store");
  }
  public static clear(response: FlowCookieResponse): void {
    response.cookie(pendingCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    response.setHeader("Cache-Control", "no-store");
  }
  private static _get(
    header: string | undefined,
    name: string,
  ): string | undefined {
    const value = header
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1);
    try {
      return value ? decodeURIComponent(value) : undefined;
    } catch {
      return undefined;
    }
  }
}
