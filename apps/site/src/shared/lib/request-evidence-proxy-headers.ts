import crypto from "node:crypto";
import { isIP } from "node:net";

/** Server-only transport. Production ingress overwrites forwarding headers in
 * infra/caddy/Caddyfile; development forwarding remains explicitly untrusted.
 */
export class RequestEvidenceProxyHeaders {
  public static create(
    headers: Headers,
    method: string,
    path: string,
    body: string,
    options: { required?: boolean } = {},
  ): Record<string, string> {
    const secret = process.env.AUTH_FLOW_PROXY_SECRET?.trim();
    if (!secret && options.required === false) return {};
    if (!secret)
      throw Object.assign(new Error("Auth flow proxy is not configured"), { status: 503 });
    const metadata: Record<string, string[]> = {};
    headers.forEach((value, key) => {
      metadata[key] = [
        this._secret(key) ? "[REDACTED]" : this._urlHeader(key) ? this._referer(value) : value,
      ];
    });
    const forwarded = (headers.get("x-forwarded-for") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const realIp = headers.get("x-real-ip")?.trim();
    const trusted = process.env.NODE_ENV === "production" && !!realIp && isIP(realIp) !== 0;
    const now = Date.now();
    const envelope = {
      issuedAt: now,
      method,
      path,
      bodySha256: crypto.createHash("sha256").update(body).digest("hex"),
      context: {
        version: 1,
        capturedAt: new Date(now).toISOString(),
        source: "next_server_action",
        // Next headers() does not expose the source method/URL/socket.
        http: { method: null, url: null, version: null },
        headers: metadata,
        connection: null,
        client: {
          ipAddress: trusted ? realIp : null,
          forwardedFor: forwarded,
          forwardedHeadersTrusted: trusted,
        },
      },
    };
    const encoded = Buffer.from(JSON.stringify(envelope)).toString("base64url");
    return {
      "x-artmate-auth-context": encoded,
      "x-artmate-auth-signature": crypto.createHmac("sha256", secret).update(encoded).digest("hex"),
    };
  }

  private static _urlHeader(name: string): boolean {
    return /(?:^|-)(?:referer|referrer|url|uri|location)$/i.test(name);
  }

  private static _secret(name: string): boolean {
    return /authorization|cookie|password|passwd|token|secret|csrf|capability|x-artmate-auth-context|x-invoke-query|signature|(^|[-_])(code|otp|state|key)($|[-_])/i.test(
      name,
    );
  }
  private static _referer(value: string): string {
    try {
      const relative = value.startsWith("/");
      const url = new URL(value, "http://request.invalid");
      url.username = "";
      url.password = "";
      url.hash = "";
      url.pathname = url.pathname.replace(
        /\/(unsubscribe|webhook|token)\/[^/]+/gi,
        "/$1/[REDACTED]",
      );
      for (const key of url.searchParams.keys())
        if (this._secret(key)) url.searchParams.set(key, "[REDACTED]");
      return relative ? `${url.pathname}${url.search}` : url.toString();
    } catch {
      return "[REDACTED]";
    }
  }
}
