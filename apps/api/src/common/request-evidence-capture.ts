import type { RequestEvidenceV1 } from "./request-evidence";

export interface EvidenceRequest {
  readonly method?: string;
  readonly originalUrl?: string;
  readonly url?: string;
  readonly httpVersion?: string;
  readonly headers: Readonly<
    Record<string, string | readonly string[] | undefined>
  >;
  readonly rawHeaders?: readonly string[];
  readonly ip?: string;
  readonly socket?: {
    readonly remoteAddress?: string;
    readonly remotePort?: number;
    readonly localAddress?: string;
    readonly localPort?: number;
    readonly encrypted?: boolean;
  };
}

/** Capture available metadata with provenance; never accepts client assertions
 * of trusted forwarding. Keep all non-secret repeated values without truncation.
 */
export class RequestEvidenceCapture {
  public static from(
    request: EvidenceRequest,
    now = new Date(),
  ): RequestEvidenceV1 {
    const headers: Record<string, string[]> = {};
    const raw = request.rawHeaders;
    if (raw?.length) {
      for (let index = 0; index + 1 < raw.length; index += 2)
        this._add(headers, raw[index]!, raw[index + 1]!);
    } else {
      for (const [key, value] of Object.entries(request.headers)) {
        for (const item of typeof value === "string" ? [value] : (value ?? []))
          this._add(headers, key, item);
      }
    }
    const parsed = new URL(
      request.originalUrl ?? request.url ?? "/",
      "http://request.invalid",
    );
    const query: Record<string, string[]> = {};
    for (const [key, value] of parsed.searchParams) {
      (query[key] ??= []).push(this._secret(key) ? "[REDACTED]" : value);
    }
    const sanitized = new URLSearchParams();
    for (const [key, values] of Object.entries(query))
      for (const value of values) sanitized.append(key, value);
    const search = sanitized.toString();
    const socket = request.socket;
    return {
      version: 1,
      capturedAt: now.toISOString(),
      source: "direct_request",
      http: {
        method: request.method ?? "",
        url: `${this._path(parsed.pathname)}${search ? `?${search}` : ""}`,
        version: request.httpVersion ?? "",
      },
      headers,
      query,
      connection: {
        remoteAddress: socket?.remoteAddress ?? null,
        remotePort: socket?.remotePort ?? null,
        localAddress: socket?.localAddress ?? null,
        localPort: socket?.localPort ?? null,
        encrypted: socket?.encrypted === true,
      },
      client: {
        ipAddress: socket?.remoteAddress ?? null,
        forwardedFor: (headers["x-forwarded-for"] ?? []).flatMap((value) =>
          value.split(",").map((item) => item.trim()),
        ),
        forwardedHeadersTrusted: false,
      },
    };
  }

  private static _add(
    headers: Record<string, string[]>,
    name: string,
    value: string,
  ): void {
    const key = name.toLowerCase();
    (headers[key] ??= []).push(
      this._secret(key)
        ? "[REDACTED]"
        : this._urlHeader(key)
          ? this._referer(value)
          : value,
    );
  }

  private static _urlHeader(name: string): boolean {
    return /(?:^|-)(?:referer|referrer|url|uri|location)$/i.test(name);
  }

  private static _secret(name: string): boolean {
    return /authorization|cookie|password|passwd|token|secret|csrf|capability|x-artmate-auth-context|x-invoke-query|signature|(^|[-_])(code|otp|state|key)($|[-_])/i.test(
      name,
    );
  }

  private static _path(value: string): string {
    return value.replace(
      /\/(unsubscribe|webhook|token)\/[^/]+/gi,
      "/$1/[REDACTED]",
    );
  }

  private static _referer(value: string): string {
    try {
      const relative = value.startsWith("/");
      const url = new URL(value, "http://request.invalid");
      url.username = "";
      url.password = "";
      url.hash = "";
      url.pathname = this._path(url.pathname);
      for (const key of url.searchParams.keys())
        if (this._secret(key)) url.searchParams.set(key, "[REDACTED]");
      return relative ? `${url.pathname}${url.search}` : url.toString();
    } catch {
      return "[REDACTED]";
    }
  }
}
