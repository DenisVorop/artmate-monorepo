import { cookies, headers } from "next/headers";
import { apiCsrfHeader } from "@/shared/lib/api-security";
import { RequestEvidenceProxyHeaders } from "@/shared/lib/request-evidence-proxy-headers";

const oauthCookies = ["artmate_oauth_yandex_state", "artmate_oauth_yandex_pkce"];
const allowedCookies = ["artmate_auth_pending", "artmate_auth_browser"];

/** Transport only. Only start/completion forward the existing session for
 * server-side account-switch checks. Only COMPLETED can install a new session. */
export class AuthFlowTransport {
  public static request<T>(path: string, method = "POST", input?: unknown): Promise<T> {
    return this._request<T>(path, method, input, "pending");
  }
  public static oauth<T>(path: string, method = "POST", input?: unknown): Promise<T> {
    return this._request<T>(path, method, input, "oauth");
  }
  public static start<T>(): Promise<T> {
    return this._request<T>("/auth/flow/start", "POST", undefined, "start");
  }
  public static complete<T>(input: unknown): Promise<T> {
    return this._request<T>("/auth/flow/complete", "POST", input, "completion");
  }
  public static resume<T>(): Promise<T> {
    return this._request<T>("/auth/flow/complete", "GET", undefined, "completion");
  }
  private static async _request<T>(
    path: string,
    method: string,
    input: unknown,
    mode: "pending" | "start" | "completion" | "oauth",
  ): Promise<T> {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const body = method === "GET" ? "" : JSON.stringify(input ?? {});
    const forwardedCookies =
      mode === "pending"
        ? allowedCookies
        : mode === "oauth"
          ? [...allowedCookies, ...oauthCookies]
          : [...allowedCookies, "artmate_access_token"];
    const cookie = forwardedCookies
      .flatMap((name) => {
        const value = cookieStore.get(name)?.value;
        return value ? [`${name}=${encodeURIComponent(value)}`] : [];
      })
      .join("; ");
    const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:3002"}${path}`, {
      method,
      ...(body ? { body } : {}),
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        cookie,
        ...apiCsrfHeader,
        ...RequestEvidenceProxyHeaders.create(headerStore, method, path, body),
      },
    });
    if (!response.ok)
      throw Object.assign(new Error("Auth flow request failed"), { status: response.status });
    const result: unknown = await response.json();
    const completed =
      mode === "completion" &&
      result !== null &&
      typeof result === "object" &&
      "status" in result &&
      result.status === "COMPLETED";
    for (const value of response.headers.getSetCookie()) {
      const parts = value.split(";").map((part) => part.trim());
      const index = parts[0]!.indexOf("=");
      const name = parts[0]!.slice(0, index);
      if (
        !allowedCookies.includes(name) &&
        !(mode === "oauth" && oauthCookies.includes(name)) &&
        !(completed && name === "artmate_access_token")
      )
        continue;
      const maxAge = Number(
        parts.find((part) => part.toLowerCase().startsWith("max-age="))?.slice(8) ?? 900,
      );
      const domain =
        name === "artmate_access_token" ? process.env.AUTH_COOKIE_DOMAIN?.trim() : undefined;
      cookieStore.set(name, decodeURIComponent(parts[0]!.slice(index + 1)), {
        ...(domain ? { domain } : {}),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Number.isFinite(maxAge) ? maxAge : 900,
      });
    }
    return result as T;
  }
}
