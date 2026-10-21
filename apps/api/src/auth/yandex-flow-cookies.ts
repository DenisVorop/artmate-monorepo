import { UnauthorizedException } from "@nestjs/common";
import type { FlowCookieResponse } from "./flow-cookies";

export const yandexStateCookieName = "artmate_oauth_yandex_state";
export const yandexPkceCookieName = "artmate_oauth_yandex_pkce";

export class YandexFlowCookies {
  public static read(header?: string): { state: string; verifier: string } {
    const state = this._read(header, yandexStateCookieName);
    const verifier = this._read(header, yandexPkceCookieName);
    if (
      !state ||
      !verifier ||
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      !/^[A-Za-z0-9_-]{43}$/.test(verifier)
    )
      throw new UnauthorizedException(
        "OAuth continuation is missing or expired",
      );
    return { state, verifier };
  }

  public static write(
    response: FlowCookieResponse,
    state: string,
    verifier: string,
  ): void {
    this._write(response, yandexStateCookieName, state, 600_000);
    this._write(response, yandexPkceCookieName, verifier, 600_000);
  }

  public static clear(response: FlowCookieResponse): void {
    this._write(response, yandexStateCookieName, "", 0);
    this._write(response, yandexPkceCookieName, "", 0);
  }

  private static _write(
    response: FlowCookieResponse,
    name: string,
    value: string,
    maxAge: number,
  ): void {
    response.cookie(name, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    });
    response.setHeader("Cache-Control", "no-store");
  }

  private static _read(
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
