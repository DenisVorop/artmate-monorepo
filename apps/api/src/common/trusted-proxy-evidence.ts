import crypto from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import type {
  RequestEvidenceV1,
  UpstreamRequestEvidenceV1,
} from "./request-evidence";
import {
  RequestEvidenceCapture,
  type EvidenceRequest,
} from "./request-evidence-capture";

/** Optional shared HTTP metadata envelope. No domain rule or business effect. */
export class TrustedProxyEvidence {
  public static from(
    request: EvidenceRequest & { readonly body?: unknown },
    secret?: string,
  ): RequestEvidenceV1 {
    const result = RequestEvidenceCapture.from(request);
    const encoded = request.headers["x-artmate-auth-context"];
    const signature = request.headers["x-artmate-auth-signature"];
    if (encoded === undefined && signature === undefined) return result;
    if (typeof encoded !== "string" || typeof signature !== "string")
      throw new ForbiddenException("Invalid auth proxy context");
    if (!secret) throw new ForbiddenException("Invalid proxy context");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(encoded)
      .digest("hex");
    if (!this._equal(expected, signature))
      throw new ForbiddenException("Invalid auth proxy context");
    try {
      const envelope = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      ) as {
        issuedAt: number;
        method: string;
        path: string;
        bodySha256: string;
        context: UpstreamRequestEvidenceV1;
      };
      const body = ["GET", "HEAD"].includes(request.method ?? "")
        ? ""
        : JSON.stringify(request.body ?? {});
      if (
        Math.abs(Date.now() - envelope.issuedAt) > 60_000 ||
        !Number.isFinite(envelope.issuedAt) ||
        envelope.method !== request.method ||
        envelope.path !== (request.originalUrl ?? request.url) ||
        envelope.bodySha256 !==
          crypto.createHash("sha256").update(body).digest("hex") ||
        envelope.context?.version !== 1 ||
        !envelope.context.headers ||
        !envelope.context.client
      )
        throw new Error("Invalid envelope");
      return {
        ...result,
        source: "trusted_site_proxy",
        client: envelope.context.client,
        upstream: envelope.context,
      };
    } catch {
      throw new ForbiddenException("Invalid auth proxy context");
    }
  }
  private static _equal(expected: string, actual: string): boolean {
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }
}
