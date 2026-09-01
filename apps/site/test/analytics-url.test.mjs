import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function loadSanitizer() {
  const source = await readFile(
    new URL("../src/shared/lib/analytics/sanitize-analytics-url.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };

  new Function("module", "exports", output)(loadedModule, loadedModule.exports);

  return loadedModule.exports;
}

test("analytics URL removes sensitive query params case-insensitively and clears hash", async () => {
  const { sanitizeAnalyticsUrl } = await loadSanitizer();
  const result = sanitizeAnalyticsUrl(
    "https://artmate.ru/auth?utm_source=yandex&TOKEN=secret&tgWebAppData=data&Email=user%40example.com#access-token",
  );

  assert.equal(result, "https://artmate.ru/auth?utm_source=yandex");
});

test("analytics URL removes Telegram auth fields and nested navigation targets", async () => {
  const { sanitizeAnalyticsUrl } = await loadSanitizer();
  const result = sanitizeAnalyticsUrl(
    "https://artmate.ru/auth?tgWebAppVersion=8.0&tgWebAppPlatform=ios&tgWebAppThemeParams=%7B%7D&auth_date=1&query_id=q&signature=s&user=%7B%7D&next=%2Freset%3Ftoken%3Dsecret&utm_medium=cpc",
  );

  assert.equal(result, "https://artmate.ru/auth?utm_medium=cpc");
});

test("analytics URL removes credentials, PII-like values and unsafe fragments", async () => {
  const { sanitizeAnalyticsUrl } = await loadSanitizer();
  const result = sanitizeAnalyticsUrl(
    "https://person:password@artmate.ru/checkout?campaign=hello%40example.com&contact=%2B7%20999%20123-45-67&jwt=aaa.bbb.ccc&utm_campaign=autumn#order",
  );

  assert.equal(result, "https://artmate.ru/checkout?utm_campaign=autumn");
});

test("analytics URL removes compound PII and auth parameter names", async () => {
  const { sanitizeAnalyticsUrl } = await loadSanitizer();
  const result = sanitizeAnalyticsUrl(
    "https://artmate.ru/checkout?auth_hash=secret&contact_name=Denis&buyer_first_name=Denis&shipping_street=Tverskaya&utm_content=checkout",
  );

  assert.equal(result, "https://artmate.ru/checkout?utm_content=checkout");
});

test("analytics URL supports a relative value only with an explicit base", async () => {
  const { sanitizeAnalyticsUrl } = await loadSanitizer();

  assert.equal(
    sanitizeAnalyticsUrl("/catalog?utm_source=site&code=secret", "https://artmate.ru/current"),
    "https://artmate.ru/catalog?utm_source=site",
  );
  assert.equal(sanitizeAnalyticsUrl("/catalog?utm_source=site"), "");
});

test("analytics URL fails closed for empty and malformed inputs", async () => {
  const { sanitizeAnalyticsUrl } = await loadSanitizer();

  assert.equal(sanitizeAnalyticsUrl(""), "");
  assert.equal(sanitizeAnalyticsUrl("not a URL"), "");
  assert.equal(sanitizeAnalyticsUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeAnalyticsUrl("data:text/plain,secret"), "");
});
