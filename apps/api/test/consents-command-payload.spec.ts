import assert from "node:assert/strict";
import { test } from "node:test";
import { ConsentCommandPayload } from "../src/consents/contracts/consent-command-payload";
import type { ApplyConsentDecisionIntentV1 } from "../src/consents/contracts/consent-decision.contract";

const intent: Omit<ApplyConsentDecisionIntentV1, "payloadHash"> = {
  contractVersion: 1,
  operationId: "operation-1",
  identityFactId: "identity-1",
  expectedStateRevision: 2,
  expectedAdvertisingVersion: 3,
  decisions: [
    { revisionId: "pdn-v1", accepted: true },
    { revisionId: "ads-v1", accepted: false },
  ],
  source: "contact-form",
  requestId: "request-1",
  requestContext: {
    version: 1,
    capturedAt: "2026-10-20T10:00:00.000Z",
    source: "direct_request",
    http: { method: "POST", url: "/auth/flow/complete", version: "1.1" },
    headers: { "user-agent": ["Example"], "accept-language": ["ru"] },
    query: {},
    connection: {
      remoteAddress: "127.0.0.1",
      remotePort: 123,
      localAddress: "127.0.0.1",
      localPort: 3002,
      encrypted: false,
    },
    client: {
      ipAddress: "127.0.0.1",
      forwardedFor: [],
      forwardedHeadersTrusted: false,
    },
  },
};

test("durable consent hash survives JSONB key ordering and decision ordering", () => {
  const reordered = {
    ...intent,
    decisions: [...intent.decisions].reverse(),
    requestContext: {
      ...intent.requestContext,
      headers: { "accept-language": ["ru"], "user-agent": ["Example"] },
    },
  };
  assert.equal(
    ConsentCommandPayload.hash(intent),
    ConsentCommandPayload.hash(reordered),
  );
});

test("durable consent hash binds actor, versions, exact choices, source and evidence", () => {
  const baseline = ConsentCommandPayload.hash(intent);
  const changes: Partial<Omit<ApplyConsentDecisionIntentV1, "payloadHash">>[] =
    [
      { operationId: "other-operation" },
      { identityFactId: "other-proof" },
      { expectedStateRevision: 4 },
      { expectedAdvertisingVersion: 5 },
      {
        decisions: intent.decisions.map((decision) => ({
          ...decision,
          accepted: true,
        })),
      },
      {
        decisions: [
          { revisionId: "pdn-v2", accepted: true },
          intent.decisions[1]!,
        ],
      },
      { source: "notification-settings" },
      { requestId: "other-request" },
      {
        requestContext: {
          ...intent.requestContext,
          http: { ...intent.requestContext.http, method: "GET" },
        },
      },
      {
        requestContext: {
          ...intent.requestContext,
          client: { ...intent.requestContext.client, ipAddress: "127.0.0.2" },
        },
      },
    ];
  for (const change of changes)
    assert.notEqual(
      ConsentCommandPayload.hash({ ...intent, ...change }),
      baseline,
    );
});
