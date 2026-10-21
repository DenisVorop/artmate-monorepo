import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { YandexOAuthService } from "../src/auth/yandex-oauth.service";

/** Only provider transport is mocked. No provider token/claim is accepted from
 * an application browser, and this suite never calls a real external endpoint. */
describe("Yandex authenticated provider transport", () => {
  const originalFetch = globalThis.fetch;
  const original = {
    id: process.env.YANDEX_OAUTH_CLIENT_ID,
    secret: process.env.YANDEX_OAUTH_CLIENT_SECRET,
    redirect: process.env.YANDEX_OAUTH_REDIRECT_URI,
  };
  beforeEach(() => {
    process.env.YANDEX_OAUTH_CLIENT_ID = "fixture-client";
    process.env.YANDEX_OAUTH_CLIENT_SECRET = "fixture-secret";
    process.env.YANDEX_OAUTH_REDIRECT_URI =
      "https://api.example.test/auth/oauth/yandex/callback";
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      YANDEX_OAUTH_CLIENT_ID: original.id,
      YANDEX_OAUTH_CLIENT_SECRET: original.secret,
      YANDEX_OAUTH_REDIRECT_URI: original.redirect,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("authorizes with state, a registered redirect and S256 challenge", () => {
    const url = new URL(
      new YandexOAuthService().getAuthorizationUrl("state", "challenge"),
    );
    assert.equal(url.origin, "https://oauth.yandex.ru");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      process.env.YANDEX_OAUTH_REDIRECT_URI,
    );
    assert.equal(url.searchParams.get("state"), "state");
    assert.equal(url.searchParams.get("code_challenge"), "challenge");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  });

  it("exchanges the code with the exact verifier and fetches the profile only server-side", async () => {
    const calls: { input: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ input: String(input), init: init! });
      return Response.json(
        calls.length === 1
          ? { access_token: "fixture-provider-token" }
          : {
              id: "provider-subject",
              client_id: "fixture-client",
              default_email: " USER@Example.Test ",
            },
      );
    }) as typeof fetch;
    const result = await new YandexOAuthService().getIdentityByCode(
      "fixture-code",
      "fixture-verifier",
    );
    assert.deepEqual(result, {
      providerUserId: "provider-subject",
      contactEmail: "user@example.test",
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.input, "https://oauth.yandex.ru/token");
    const body = calls[0]!.init.body as URLSearchParams;
    assert.equal(body.get("code"), "fixture-code");
    assert.equal(body.get("code_verifier"), "fixture-verifier");
    assert.equal(body.get("client_id"), "fixture-client");
    assert.equal(calls[1]!.input, "https://login.yandex.ru/info?format=json");
    assert.equal(
      (calls[1]!.init.headers as Record<string, string>).authorization,
      "OAuth fixture-provider-token",
    );
    assert.equal(
      calls.every(
        (call) =>
          call.init.redirect === "error" && call.init.signal !== undefined,
      ),
      true,
    );
    assert.equal(
      JSON.stringify(result).includes("fixture-provider-token"),
      false,
    );
  });

  it("does not accept a profile for another client", async () => {
    let count = 0;
    globalThis.fetch = (async () =>
      Response.json(
        ++count === 1
          ? { access_token: "fixture" }
          : {
              id: "subject",
              client_id: "foreign-client",
              default_email: "user@example.test",
            },
      )) as typeof fetch;
    await assert.rejects(
      () => new YandexOAuthService().getIdentityByCode("code", "verifier"),
      /Yandex profile is invalid/,
    );
  });

  it("does not treat a malformed contact email as a usable provider email", async () => {
    let count = 0;
    globalThis.fetch = (async () =>
      Response.json(
        ++count === 1
          ? { access_token: "fixture" }
          : { id: "subject", default_email: "not-an-email" },
      )) as typeof fetch;
    assert.deepEqual(
      await new YandexOAuthService().getIdentityByCode("code", "verifier"),
      { providerUserId: "subject", contactEmail: null },
    );
  });

  it("returns a generic transport error without the provider response body", async () => {
    globalThis.fetch = (async () =>
      new Response("private provider response", {
        status: 500,
      })) as typeof fetch;
    await assert.rejects(
      () => new YandexOAuthService().getIdentityByCode("code", "verifier"),
      (error: Error) => error.message === "Yandex exchange failed",
    );
  });
});
