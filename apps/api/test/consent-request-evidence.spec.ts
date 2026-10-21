import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { UpstreamRequestEvidenceV1 } from "../src/common/request-evidence";
import { TrustedProxyEvidence } from "../src/common/trusted-proxy-evidence";
import { FlowRequestEvidence } from "../src/auth/flow-request-evidence";

const secret = "isolated-shared-proxy-evidence-secret";
const upstream: UpstreamRequestEvidenceV1 = {
  version: 1,
  capturedAt: new Date().toISOString(),
  source: "next_server_action",
  headers: { "user-agent": ["Complete browser user agent"] },
  client: {
    ipAddress: "203.0.113.44",
    forwardedFor: ["203.0.113.44"],
    forwardedHeadersTrusted: true,
  },
  http: { method: null, url: null, version: null },
  connection: null,
};

function _request(issuedAt = Date.now()) {
  const path = "/consents/email-advertising/revoke";
  const envelope = {
    issuedAt,
    method: "POST",
    path,
    bodySha256: crypto.createHash("sha256").update("{}").digest("hex"),
    context: upstream,
  };
  const encoded = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  return {
    method: "POST",
    originalUrl: path,
    body: {},
    headers: {
      "x-artmate-auth-context": encoded,
      "x-artmate-auth-signature": crypto
        .createHmac("sha256", secret)
        .update(encoded)
        .digest("hex"),
    },
    socket: {
      remoteAddress: "127.0.0.1",
      remotePort: 40001,
      localAddress: "127.0.0.1",
      localPort: 3002,
    },
  };
}

describe("optional consent request evidence and mandatory Auth policy", () => {
  it("captures an unsigned withdrawal when no proxy secret is configured without inventing a trusted browser identity", () => {
    const token = "A".repeat(43);
    const result = TrustedProxyEvidence.from({
      method: "POST",
      originalUrl: `/consents/email-advertising/unsubscribe?token=${token}`,
      headers: {
        cookie: "private-cookie",
        authorization: "Bearer private-token",
        "user-agent": "Complete browser user agent",
      },
      socket: { remoteAddress: "127.0.0.1" },
    });
    assert.equal(result.source, "direct_request");
    assert.equal(result.client.forwardedHeadersTrusted, false);
    assert.equal(result.upstream, undefined);
    assert.equal(
      result.headers["user-agent"]?.[0],
      "Complete browser user agent",
    );
    for (const sensitive of [token, "private-cookie", "private-token"])
      assert.equal(JSON.stringify(result).includes(sensitive), false);
  });

  it("authenticates the exact configured upstream envelope while retaining the real API connection", () => {
    const result = TrustedProxyEvidence.from(_request(), secret);
    assert.equal(result.source, "trusted_site_proxy");
    assert.deepEqual(result.upstream, upstream);
    assert.equal(result.client.ipAddress, "203.0.113.44");
    assert.equal(result.connection.remoteAddress, "127.0.0.1");
    assert.deepEqual(result.headers["x-artmate-auth-context"], ["[REDACTED]"]);
    assert.deepEqual(result.headers["x-artmate-auth-signature"], [
      "[REDACTED]",
    ]);
  });

  it("does not promote supplied proxy headers without a configured key or valid signature", () => {
    const request = _request();
    assert.throws(() => TrustedProxyEvidence.from(request), ForbiddenException);
    assert.throws(
      () => TrustedProxyEvidence.from(request, "wrong-key"),
      ForbiddenException,
    );
    assert.throws(
      () =>
        TrustedProxyEvidence.from(
          {
            ...request,
            headers: {
              ...request.headers,
              "x-artmate-auth-signature": [
                request.headers["x-artmate-auth-signature"],
              ],
            },
          },
          secret,
        ),
      ForbiddenException,
    );
  });

  it("rejects stale or replayed envelopes on a different action, method or body", () => {
    const request = _request();
    for (const changed of [
      { ...request, method: "GET" },
      {
        ...request,
        originalUrl: "/consents/email-advertising/unsubscribe/confirm",
      },
      { ...request, body: { token: "A".repeat(43) } },
      _request(Date.now() - 120_000),
    ])
      assert.throws(
        () => TrustedProxyEvidence.from(changed, secret),
        ForbiddenException,
      );
  });

  it("keeps missing-proxy-key rejection specific to Auth flows", () => {
    const saved = process.env.AUTH_FLOW_PROXY_SECRET;
    try {
      delete process.env.AUTH_FLOW_PROXY_SECRET;
      assert.throws(
        () => FlowRequestEvidence.from({ headers: {} }),
        ServiceUnavailableException,
      );
      assert.doesNotThrow(() => TrustedProxyEvidence.from({ headers: {} }));
    } finally {
      if (saved === undefined) delete process.env.AUTH_FLOW_PROXY_SECRET;
      else process.env.AUTH_FLOW_PROXY_SECRET = saved;
    }
  });
});
