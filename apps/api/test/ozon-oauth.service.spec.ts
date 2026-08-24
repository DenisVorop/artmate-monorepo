import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadGatewayException, GatewayTimeoutException } from "@nestjs/common";

import type { PrismaService } from "../src/prisma/prisma.service";
import { ozonSellerApiRequestTimeoutMs } from "../src/ozon/ozon.constants";
import { OzonOAuthService } from "../src/ozon/ozon-oauth.service";

describe("OzonOAuthService token expiry", () => {
  it("prefers a valid JWT exp over an ambiguous expires_in value", async () => {
    const now = Date.UTC(2026, 7, 23, 12, 0, 0);
    const jwtExpiresAtSeconds = Math.floor(now / 1000) + 60 * 60;
    const accessToken = createJwt({ exp: jwtExpiresAtSeconds });
    const fixture = createOAuthFixture(now);

    await withOAuthEnvironment(async () => {
      await withDateNow(now, async () => {
        await withFetch(
          async () =>
            jsonResponse({
              access_token: accessToken,
              expires_in: Math.floor(now / 1000) + 24 * 60 * 60,
              refresh_token: "refresh-token",
            }),
          () => fixture.service.exchangeCode("authorization-code"),
        );
      });
    });

    assert.equal(
      fixture.getStoredToken()?.expiresAt.getTime(),
      jwtExpiresAtSeconds * 1000,
    );
  });

  it("treats epoch expires_in as an absolute timestamp for opaque tokens", async () => {
    const now = Date.UTC(2026, 7, 23, 12, 0, 0);
    const absoluteExpiresAtSeconds = Math.floor(now / 1000) + 2 * 60 * 60;
    const fixture = createOAuthFixture(now);

    await withOAuthEnvironment(async () => {
      await withDateNow(now, async () => {
        await withFetch(
          async () =>
            jsonResponse({
              access_token: "opaque-access-token",
              expires_in: absoluteExpiresAtSeconds,
            }),
          () => fixture.service.exchangeCode("authorization-code"),
        );
      });
    });

    assert.equal(
      fixture.getStoredToken()?.expiresAt.getTime(),
      absoluteExpiresAtSeconds * 1000,
    );
  });

  it("treats ordinary expires_in values as durations", async () => {
    const now = Date.UTC(2026, 7, 23, 12, 0, 0);
    const fixture = createOAuthFixture(now);

    await withOAuthEnvironment(async () => {
      await withDateNow(now, async () => {
        await withFetch(
          async () =>
            jsonResponse({
              access_token: "opaque-access-token",
              expires_in: 60 * 60,
            }),
          () => fixture.service.exchangeCode("authorization-code"),
        );
      });
    });

    assert.equal(
      fixture.getStoredToken()?.expiresAt.getTime(),
      now + 60 * 60 * 1000,
    );
  });

  it("normalizes an already persisted incorrect expiry from the JWT", async () => {
    const now = Date.UTC(2026, 7, 23, 12, 0, 0);
    const jwtExpiresAtSeconds = Math.floor(now / 1000) + 60 * 60;
    const fixture = createOAuthFixture(now, {
      accessToken: createJwt({ exp: jwtExpiresAtSeconds }),
      expiresAt: new Date(Date.UTC(2083, 3, 14, 12, 0, 0)),
    });

    const status = await fixture.service.getTokenStatus();

    assert.equal(
      status.expiresAt,
      new Date(jwtExpiresAtSeconds * 1000).toISOString(),
    );
  });

  it("falls back to the persisted expiry when a stored JWT exp is outside the JavaScript Date range", async () => {
    const now = Date.UTC(2026, 7, 23, 12, 0, 0);
    const persistedExpiresAt = new Date(now - 60 * 60 * 1000);
    const fixture = createOAuthFixture(now, {
      accessToken: createJwt({ exp: 8_640_000_000_001 }),
      expiresAt: persistedExpiresAt,
      refreshToken: "refresh-token",
    });

    const status = await fixture.service.getTokenStatus();

    assert.equal(status.expiresAt, persistedExpiresAt.toISOString());
  });

  it("refreshes a stored token when its JWT exp is invalid and persisted expiry is expired", async () => {
    const now = Date.UTC(2026, 7, 23, 12, 0, 0);
    const fixture = createOAuthFixture(now, {
      accessToken: createJwt({ exp: Number.MAX_VALUE }),
      expiresAt: new Date(now - 60 * 60 * 1000),
      refreshToken: "refresh-token",
    });
    let fetchCallCount = 0;
    let refreshRequestBody: unknown;

    await withOAuthEnvironment(async () => {
      await withDateNow(now, async () => {
        const accessToken = await withFetch(
          async (_input, init) => {
            fetchCallCount += 1;
            refreshRequestBody = JSON.parse(String(init?.body));

            return jsonResponse({
              access_token: "refreshed-access-token",
              expires_in: 60 * 60,
            });
          },
          () => fixture.service.getAccessToken(),
        );

        assert.equal(accessToken, "refreshed-access-token");
      });
    });

    assert.equal(fetchCallCount, 1);
    assert.deepEqual(refreshRequestBody, {
      grant_type: "refresh_token",
      client_id: "client-id",
      client_secret: "client-secret",
      refresh_token: "refresh-token",
    });
    assert.equal(
      fixture.getStoredToken()?.accessToken,
      "refreshed-access-token",
    );
  });

  it("rejects a JWT exp outside the JavaScript Date range without persisting the token", async () => {
    const now = Date.UTC(2026, 7, 23, 12, 0, 0);
    const fixture = createOAuthFixture(now);

    await withOAuthEnvironment(async () => {
      await withDateNow(now, async () => {
        await withFetch(
          async () =>
            jsonResponse({
              access_token: createJwt({ exp: Number.MAX_VALUE }),
              expires_in: 60 * 60,
            }),
          async () => {
            await assert.rejects(
              fixture.service.exchangeCode("authorization-code"),
              isBadGateway,
            );
          },
        );
      });
    });

    assert.equal(fixture.getStoredToken(), undefined);
  });

  it("rejects an expires_in outside the JavaScript Date range without persisting the token", async () => {
    const now = Date.UTC(2026, 7, 23, 12, 0, 0);
    const fixture = createOAuthFixture(now);

    await withOAuthEnvironment(async () => {
      await withDateNow(now, async () => {
        await withFetch(
          async () =>
            jsonResponse({
              access_token: "opaque-access-token",
              expires_in: 8_640_000_000_000_001,
            }),
          async () => {
            await assert.rejects(
              fixture.service.exchangeCode("authorization-code"),
              isBadGateway,
            );
          },
        );
      });
    });

    assert.equal(fixture.getStoredToken(), undefined);
  });

  it("rejects a malformed token response as an upstream failure", async () => {
    const now = Date.UTC(2026, 7, 23, 12, 0, 0);
    const fixture = createOAuthFixture(now);

    await withOAuthEnvironment(async () => {
      await withFetch(
        async () => jsonResponse(null),
        async () => {
          await assert.rejects(
            fixture.service.exchangeCode("authorization-code"),
            BadGatewayException,
          );
        },
      );
    });
  });
});

describe("OzonOAuthService OAuth token transport", () => {
  it("bounds standalone exchange and refresh token requests and maps timeouts to 504", async () => {
    const operations: Array<(service: OzonOAuthService) => Promise<unknown>> = [
      (service) => service.exchangeCode("authorization-code"),
      (service) => service.refreshAccessToken("refresh-token"),
    ];

    await withOAuthEnvironment(async () => {
      for (const operation of operations) {
        const fixture = createOAuthFixture(Date.now());
        const timeoutController = new AbortController();
        let configuredTimeout: number | undefined;
        let requestSignal: AbortSignal | null | undefined;
        let timeoutCallCount = 0;

        await withAbortSignalTimeout(
          (milliseconds) => {
            timeoutCallCount += 1;
            configuredTimeout = milliseconds;

            return timeoutController.signal;
          },
          async () => {
            await withFetch(
              async (_input, init) => {
                requestSignal = init?.signal;
                setImmediate(() =>
                  timeoutController.abort(
                    new DOMException("request timed out", "TimeoutError"),
                  ),
                );

                return hangUntilAborted(init?.signal);
              },
              async () => {
                await assert.rejects(
                  operation(fixture.service),
                  isGatewayTimeout,
                );
              },
            );
          },
        );

        assert.equal(configuredTimeout, ozonSellerApiRequestTimeoutMs);
        assert.equal(requestSignal, timeoutController.signal);
        assert.equal(timeoutCallCount, 1);
        assert.equal(fixture.getStoredToken(), undefined);
      }
    });
  });

  it("maps malformed exchange and refresh JSON to 502 without leaking response or token data", async () => {
    const operations: Array<(service: OzonOAuthService) => Promise<unknown>> = [
      (service) => service.exchangeCode("authorization-code"),
      (service) => service.refreshAccessToken("refresh-token"),
    ];

    await withOAuthEnvironment(async () => {
      for (const operation of operations) {
        const fixture = createOAuthFixture(Date.now());

        await withFetch(
          async () =>
            new Response("not-json", {
              headers: { "content-type": "application/json" },
              status: 200,
            }),
          async () => {
            await assert.rejects(
              operation(fixture.service),
              isSafeOAuthTokenTransportError,
            );
          },
        );
        assert.equal(fixture.getStoredToken(), undefined);
      }
    });
  });

  it("maps OAuth token fetch failures to 502 without leaking request secrets", async () => {
    const fixture = createOAuthFixture(Date.now());

    await withOAuthEnvironment(async () => {
      await withFetch(
        async () => {
          throw new TypeError("fetch failed with client-secret");
        },
        async () => {
          await assert.rejects(
            fixture.service.exchangeCode("authorization-code"),
            isSafeOAuthTokenTransportError,
          );
        },
      );
    });
  });
});

describe("OzonOAuthService Seller API transport", () => {
  it("uses one shared deadline signal for an expired-token refresh and Seller fetch", async () => {
    const now = Date.now();
    const fixture = createOAuthFixture(now, {
      accessToken: "expired-access-token",
      expiresAt: new Date(now - 1),
      refreshToken: "refresh-token",
    });
    const timeoutController = new AbortController();
    let configuredTimeout: number | undefined;
    let refreshSignal: AbortSignal | null | undefined;
    let sellerSignal: AbortSignal | null | undefined;
    let timeoutCallCount = 0;
    const fetchCalls: Array<{ body: unknown; url: string }> = [];
    const sellerRequestBody = { viewport: "moscow" };
    let responseBody: unknown;

    await withOAuthEnvironment(async () => {
      await withAbortSignalTimeout(
        (milliseconds) => {
          timeoutCallCount += 1;
          configuredTimeout = milliseconds;

          return timeoutController.signal;
        },
        async () => {
          await withFetch(
            async (input, init) => {
              const body = JSON.parse(String(init?.body)) as unknown;

              fetchCalls.push({ body, url: String(input) });

              if (fetchCalls.length === 1) {
                refreshSignal = init?.signal;

                return jsonResponse({
                  access_token: "refreshed-access-token",
                  expires_in: 60 * 60,
                });
              }

              sellerSignal = init?.signal;

              return jsonResponse({ clusters: [] });
            },
            async () => {
              responseBody = await fixture.service.requestSellerApi(
                "/v1/delivery/map",
                sellerRequestBody,
              );
            },
          );
        },
      );
    });

    assert.equal(configuredTimeout, ozonSellerApiRequestTimeoutMs);
    assert.equal(timeoutCallCount, 1);
    assert.equal(refreshSignal, timeoutController.signal);
    assert.equal(sellerSignal, timeoutController.signal);
    assert.equal(refreshSignal, sellerSignal);
    assert.equal(fetchCalls.length, 2);
    assert.deepEqual(fetchCalls[0]?.body, {
      grant_type: "refresh_token",
      client_id: "client-id",
      client_secret: "client-secret",
      refresh_token: "refresh-token",
    });
    assert.equal(fetchCalls[1]?.url.endsWith("/v1/delivery/map"), true);
    assert.deepEqual(fetchCalls[1]?.body, sellerRequestBody);
    assert.deepEqual(responseBody, { clusters: [] });
  });

  it("sets the bounded request timeout and maps timeout failures to 504", async () => {
    const fixture = createOAuthFixture(Date.now(), {
      accessToken: "secret-access-token",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    let requestSignal: AbortSignal | null | undefined;
    let configuredTimeout: number | undefined;
    const originalTimeout = AbortSignal.timeout;

    AbortSignal.timeout = (milliseconds: number) => {
      configuredTimeout = milliseconds;

      return new AbortController().signal;
    };

    try {
      await withFetch(
        async (_input, init) => {
          requestSignal = init?.signal;
          throw Object.assign(new Error("request timed out"), {
            name: "TimeoutError",
          });
        },
        async () => {
          await assert.rejects(
            fixture.service.requestSellerApi("/v1/delivery/map", {}),
            (error) =>
              error instanceof GatewayTimeoutException &&
              !JSON.stringify(error.getResponse()).includes(
                "secret-access-token",
              ),
          );
        },
      );
    } finally {
      AbortSignal.timeout = originalTimeout;
    }

    assert.equal(configuredTimeout, ozonSellerApiRequestTimeoutMs);
    assert.equal(requestSignal instanceof AbortSignal, true);
  });

  it("maps other Seller API transport failures to 502", async () => {
    const fixture = createOAuthFixture(Date.now(), {
      accessToken: "secret-access-token",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await withFetch(
      async () => {
        throw new TypeError("fetch failed");
      },
      async () => {
        await assert.rejects(
          fixture.service.requestSellerApi("/v1/delivery/map", {}),
          BadGatewayException,
        );
      },
    );
  });

  it("maps a malformed Seller API JSON response to 502", async () => {
    const fixture = createOAuthFixture(Date.now(), {
      accessToken: "secret-access-token",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await withFetch(
      async () =>
        new Response("not-json", {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      async () => {
        await assert.rejects(
          fixture.service.requestSellerApi("/v1/delivery/map", {}),
          BadGatewayException,
        );
      },
    );
  });
});

type StoredToken = {
  accessToken: string;
  expiresAt: Date;
  refreshToken: string | null;
  scope: string[];
  tokenKey: string;
  tokenType: string | null;
  updatedAt: Date;
};

function createOAuthFixture(
  now: number,
  initialToken?: Pick<StoredToken, "accessToken" | "expiresAt"> &
    Partial<Pick<StoredToken, "refreshToken">>,
) {
  let storedToken: StoredToken | undefined = initialToken
    ? {
        ...initialToken,
        refreshToken: initialToken.refreshToken ?? null,
        scope: [],
        tokenKey: "default",
        tokenType: "Bearer",
        updatedAt: new Date(now),
      }
    : undefined;
  const prisma = {
    ozonOAuthToken: {
      findUnique: async () => storedToken ?? null,
      upsert: async (input: { create: Omit<StoredToken, "updatedAt"> }) => {
        storedToken = {
          ...input.create,
          updatedAt: new Date(now),
        };

        return storedToken;
      },
    },
  } as unknown as PrismaService;

  return {
    getStoredToken: () => storedToken,
    service: new OzonOAuthService(prisma),
  };
}

function createJwt(payload: object) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function isSafeOAuthTokenTransportError(error: unknown) {
  if (!(error instanceof BadGatewayException) || error.getStatus() !== 502) {
    return false;
  }

  const response = JSON.stringify(error.getResponse());

  return ![
    "not-json",
    "authorization-code",
    "refresh-token",
    "client-secret",
  ].some((secret) => response.includes(secret));
}

function isBadGateway(error: unknown) {
  return error instanceof BadGatewayException && error.getStatus() === 502;
}

function isGatewayTimeout(error: unknown) {
  return (
    error instanceof GatewayTimeoutException && error.getStatus() === 504
  );
}

function hangUntilAborted(signal: AbortSignal | null | undefined) {
  if (!signal) {
    return Promise.reject(new Error("A bounded AbortSignal is required"));
  }

  return new Promise<Response>((_resolve, reject) => {
    const rejectOnAbort = () => reject(signal.reason);

    if (signal.aborted) {
      rejectOnAbort();
      return;
    }

    signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
}

async function withFetch<T>(
  implementation: typeof fetch,
  callback: () => Promise<T>,
) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = implementation;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withAbortSignalTimeout<T>(
  implementation: typeof AbortSignal.timeout,
  callback: () => Promise<T>,
) {
  const originalTimeout = AbortSignal.timeout;

  AbortSignal.timeout = implementation;

  try {
    return await callback();
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
}

async function withDateNow<T>(now: number, callback: () => Promise<T>) {
  const originalDateNow = Date.now;

  Date.now = () => now;

  try {
    return await callback();
  } finally {
    Date.now = originalDateNow;
  }
}

async function withOAuthEnvironment<T>(callback: () => Promise<T>) {
  const previousClientId = process.env.OZON_OAUTH_CLIENT_ID;
  const previousClientSecret = process.env.OZON_OAUTH_CLIENT_SECRET;

  process.env.OZON_OAUTH_CLIENT_ID = "client-id";
  process.env.OZON_OAUTH_CLIENT_SECRET = "client-secret";

  try {
    return await callback();
  } finally {
    restoreEnvironment("OZON_OAUTH_CLIENT_ID", previousClientId);
    restoreEnvironment("OZON_OAUTH_CLIENT_SECRET", previousClientSecret);
  }
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
