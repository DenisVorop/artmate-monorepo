import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Test the real ESM site's wire encoder from the CommonJS API test runner.
const siteModule = {
  exports: {} as {
    RequestEvidenceProxyHeaders?: {
      create(
        headers: Headers,
        method: string,
        path: string,
        body: string,
      ): Record<string, string>;
    };
  },
};
const compiledSite = ts.transpileModule(
  readFileSync(
    resolve(
      __dirname,
      "../../site/src/shared/lib/request-evidence-proxy-headers.ts",
    ),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  },
).outputText;
new Function("require", "module", "exports", compiledSite)(
  createRequire(__filename),
  siteModule,
  siteModule.exports,
);
const RequestEvidenceProxyHeaders =
  siteModule.exports.RequestEvidenceProxyHeaders!;
import { RequestEvidenceCapture } from "../src/common/request-evidence-capture";
import { FlowRequestEvidence } from "../src/auth/flow-request-evidence";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../src/auth/auth.service";
import { AuthGuard } from "../src/auth/auth.guard";
import { FlowCredentials } from "../src/auth/flow-credentials";
import { FlowCookies } from "../src/auth/flow-cookies";
import { PasswordHasher } from "../src/auth/password-hasher";
import { RegistrationCode } from "../src/auth/registration-code";

describe("auth flow protocol security", () => {
  const original = {
    proxy: process.env.AUTH_FLOW_PROXY_SECRET,
    code: process.env.AUTH_EMAIL_VERIFICATION_SECRET,
    node: process.env.NODE_ENV,
    jwt: process.env.AUTH_JWT_SECRET,
  };
  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = "test-existing-jwt-secret";
    process.env.AUTH_FLOW_PROXY_SECRET = "test-proxy-secret-separate-from-jwt";
    process.env.AUTH_EMAIL_VERIFICATION_SECRET =
      "test-email-secret-separate-from-proxy";
  });
  afterEach(() => {
    for (const [key, value] of Object.entries({
      AUTH_FLOW_PROXY_SECRET: original.proxy,
      AUTH_EMAIL_VERIFICATION_SECRET: original.code,
      NODE_ENV: original.node,
      AUTH_JWT_SECRET: original.jwt,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("verifies existing Artmate scrypt hashes and produces the same format", async () => {
    const salt = "c".repeat(32);
    const hash = await new Promise<Buffer>((resolve, reject) =>
      crypto.scrypt("existing-password", salt, 64, (error, key) =>
        error ? reject(error) : resolve(key),
      ),
    );
    assert.equal(
      await PasswordHasher.verify(
        "existing-password",
        `scrypt:${salt}:${hash.toString("hex")}`,
      ),
      true,
    );
    assert.equal(
      await PasswordHasher.verify(
        "wrong-password",
        `scrypt:${salt}:${hash.toString("hex")}`,
      ),
      false,
    );
    const created = await PasswordHasher.create("new-password");
    assert.match(created, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.equal(await PasswordHasher.verify("new-password", created), true);
  });

  it("derives different registration proofs per nonce/generation/purpose without raw code storage", () => {
    const secret = RegistrationCode.secret();
    const code = RegistrationCode.derive("challenge", "nonce", 1, secret);
    assert.match(code, /^\d{6}$/);
    const proof = RegistrationCode.digest(
      "challenge",
      "nonce",
      1,
      code,
      secret,
    );
    assert.notEqual(proof, code);
    assert.notEqual(
      proof,
      RegistrationCode.digest("challenge", "nonce", 2, code, secret),
    );
    assert.notEqual(
      proof,
      RegistrationCode.digest("challenge", "different-nonce", 1, code, secret),
    );
    assert.notEqual(
      proof,
      RegistrationCode.hash(["email-verification", "challenge", code], secret),
    );
  });

  it("keeps repeated metadata/socket context while redacting credentials and secret query values", () => {
    const context = RequestEvidenceCapture.from({
      method: "POST",
      originalUrl: "/auth/flow?source=a&source=b&token=private-token",
      httpVersion: "1.1",
      headers: {},
      rawHeaders: [
        "User-Agent",
        "x".repeat(5000),
        "X-Test",
        "first",
        "X-Test",
        "second",
        "Cookie",
        "private-cookie",
        "Authorization",
        "private-bearer",
        "Referer",
        "https://artmate.test/auth?token=private-link&source=page",
      ],
      socket: {
        remoteAddress: "127.0.0.1",
        remotePort: 55555,
        localAddress: "127.0.0.1",
        localPort: 3002,
        encrypted: true,
      },
    });
    assert.equal(context.headers["user-agent"]![0]!.length, 5000);
    assert.deepEqual(context.headers["x-test"], ["first", "second"]);
    assert.deepEqual(context.query.source, ["a", "b"]);
    assert.equal(context.connection.remotePort, 55555);
    assert.equal(context.client.forwardedHeadersTrusted, false);
    for (const secret of [
      "private-token",
      "private-cookie",
      "private-bearer",
      "private-link",
    ])
      assert.equal(JSON.stringify(context).includes(secret), false);
  });

  it("verifies the actual site envelope and binds it to method/path/body/time", () => {
    process.env.NODE_ENV = "production";
    const headers = new Headers({
      "x-real-ip": "203.0.113.5",
      "x-forwarded-for": "203.0.113.5",
      cookie: "browser-secret",
      authorization: "Bearer secret",
      "user-agent": "Site Browser",
    });
    const body = { email: "user@example.test", password: "secret-password" };
    const proxy = RequestEvidenceProxyHeaders.create(
      headers,
      "POST",
      "/auth/flow/password",
      JSON.stringify(body),
    );
    const request = {
      method: "POST",
      originalUrl: "/auth/flow/password",
      body,
      headers: proxy,
      socket: { remoteAddress: "127.0.0.1" },
    };
    const result = FlowRequestEvidence.from(request);
    assert.equal(result.source, "trusted_site_proxy");
    assert.equal(result.client.ipAddress, "203.0.113.5");
    assert.equal(result.client.forwardedHeadersTrusted, true);
    assert.equal(result.connection.remoteAddress, "127.0.0.1");
    assert.deepEqual(result.upstream?.headers["user-agent"], ["Site Browser"]);
    assert.equal(result.upstream?.source, "next_server_action");
    assert.deepEqual(result.upstream?.http, {
      method: null,
      url: null,
      version: null,
    });
    assert.equal(result.upstream?.connection, null);
    assert.equal(JSON.stringify(result).includes("browser-secret"), false);
    assert.equal(JSON.stringify(result).includes("secret-password"), false);
    assert.throws(() =>
      FlowRequestEvidence.from({
        ...request,
        body: { ...body, email: "another@example.test" },
      }),
    );
    assert.throws(() =>
      FlowRequestEvidence.from({
        ...request,
        originalUrl: "/auth/email-code/confirm",
      }),
    );
    assert.throws(() =>
      FlowRequestEvidence.from({ ...request, method: "GET" }),
    );
    assert.throws(() =>
      FlowRequestEvidence.from({
        ...request,
        headers: { ...proxy, "x-artmate-auth-signature": "fake" },
      }),
    );
    const decoded = JSON.parse(
      Buffer.from(proxy["x-artmate-auth-context"]!, "base64url").toString(),
    ) as { issuedAt: number };
    decoded.issuedAt = Date.now() - 120_000;
    const encoded = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    assert.throws(() =>
      FlowRequestEvidence.from({
        ...request,
        headers: {
          "x-artmate-auth-context": encoded,
          "x-artmate-auth-signature": crypto
            .createHmac("sha256", process.env.AUTH_FLOW_PROXY_SECRET!)
            .update(encoded)
            .digest("hex"),
        },
      }),
    );
  });

  it("never trusts an unsigned forwarded IP or development forwarding", () => {
    const direct = FlowRequestEvidence.from({
      method: "POST",
      originalUrl: "/auth/flow/password",
      headers: { "x-real-ip": "203.0.113.5", "x-forwarded-for": "203.0.113.5" },
      socket: { remoteAddress: "127.0.0.1" },
    });
    assert.equal(direct.source, "direct_request");
    assert.equal(direct.client.ipAddress, "127.0.0.1");
    assert.equal(direct.client.forwardedHeadersTrusted, false);
    process.env.NODE_ENV = "development";
    const envelope = RequestEvidenceProxyHeaders.create(
      new Headers({ "x-real-ip": "203.0.113.5" }),
      "GET",
      "/auth/flow",
      "",
    );
    const forwarded = FlowRequestEvidence.from({
      method: "GET",
      originalUrl: "/auth/flow",
      headers: envelope,
    });
    assert.equal(forwarded.client.ipAddress, null);
    assert.equal(forwarded.client.forwardedHeadersTrusted, false);
  });

  it("never accepts a pending capability as either an ordinary cookie or a JWT", async () => {
    const auth = new AuthService(
      new JwtService(),
      {} as never,
      {} as never,
      {} as never,
    );
    const guard = new AuthGuard(auth);
    const credentials = FlowCredentials.create();
    for (const headers of [
      {
        cookie: `artmate_auth_pending=${credentials.pending}; artmate_auth_browser=${credentials.browser}`,
      },
      { authorization: `Bearer ${credentials.pending}` },
    ]) {
      const context = {
        switchToHttp: () => ({ getRequest: () => ({ headers }) }),
      };
      await assert.rejects(guard.canActivate(context as never), {
        status: 401,
      });
    }
  });

  it("the real Next transport synchronizes only pending cookies and never forwards or accepts an access token", async () => {
    const writes: { name: string; value: string }[] = [];
    const oldFetch = globalThis.fetch;
    const cookieStore = {
      get: (name: string) => ({
        value:
          name === "artmate_access_token"
            ? "ordinary-access-token"
            : "pending-value",
      }),
      set: (name: string, value: string) => writes.push({ name, value }),
    };
    const module = {
      exports: {} as {
        AuthFlowTransport?: {
          request<T>(path: string, method: string, body: unknown): Promise<T>;
        };
      },
    };
    const source = ts.transpileModule(
      readFileSync(
        resolve(
          __dirname,
          "../../site/src/shared/actions/auth/lib/request-flow.ts",
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      },
    ).outputText;
    const requestRequire = (id: string) =>
      id === "next/headers"
        ? {
            cookies: async () => cookieStore,
            headers: async () => new Headers(),
          }
        : id === "@/shared/lib/api-security"
          ? { apiCsrfHeader: { "x-artmate-csrf": "1" } }
          : id === "@/shared/lib/request-evidence-proxy-headers"
            ? { RequestEvidenceProxyHeaders }
            : createRequire(__filename)(id);
    new Function("require", "module", "exports", source)(
      requestRequire,
      module,
      module.exports,
    );
    globalThis.fetch = async (_url, init) => {
      assert.equal(
        new Headers(init?.headers)
          .get("cookie")
          ?.includes("ordinary-access-token"),
        false,
      );
      const response = new Response(
        JSON.stringify({ status: "PENDING", nextStep: "preparing" }),
      );
      response.headers.append(
        "set-cookie",
        "artmate_access_token=premature-token; HttpOnly; Max-Age=600",
      );
      response.headers.append(
        "set-cookie",
        "artmate_auth_pending=opaque; HttpOnly; Max-Age=900",
      );
      response.headers.append(
        "set-cookie",
        "artmate_auth_browser=browser; HttpOnly; Max-Age=900",
      );
      return response;
    };
    try {
      const result = await module.exports.AuthFlowTransport!.request<{
        status: string;
      }>("/auth/flow/password", "POST", {
        email: "user@example.test",
        password: "password",
      });
      assert.equal(result.status, "PENDING");
      assert.deepEqual(
        writes.map((item) => item.name),
        ["artmate_auth_pending", "artmate_auth_browser"],
      );
    } finally {
      globalThis.fetch = oldFetch;
    }
  });

  it("sets only restricted cookies and keeps capabilities out of response bodies", () => {
    const credentials = FlowCredentials.create();
    const writes: {
      name: string;
      value: string;
      options: { httpOnly: boolean; sameSite: string; secure: boolean };
    }[] = [];
    FlowCookies.write(
      {
        cookie: (name, value, options) => writes.push({ name, value, options }),
        setHeader: () => {},
      },
      credentials,
    );
    assert.deepEqual(
      writes.map((item) => item.name),
      ["artmate_auth_pending", "artmate_auth_browser"],
    );
    assert.equal(
      writes.every(
        (item) => item.options.httpOnly && item.options.sameSite === "lax",
      ),
      true,
    );
    assert.notEqual(
      FlowCredentials.browserHash(credentials),
      FlowCredentials.browserHash({ ...credentials, browser: "a".repeat(64) }),
    );
    assert.notEqual(
      FlowCredentials.capabilityHash(credentials),
      credentials.pending,
    );
    assert.equal(
      FlowCookies.read("artmate_access_token=ordinary-session"),
      undefined,
    );
  });
});
