import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(path: string) {
  const url = new URL(`../../../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const dockerfile = readRepoFile("apps/affiliate/Dockerfile");
const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
const publishWorkflow = readRepoFile(".github/workflows/docker-publish.yml");
const deployWorkflow = readRepoFile(".github/workflows/deploy.yml");
const compose = readRepoFile("docker-compose.prod.yml");
const caddyfile = readRepoFile("infra/caddy/Caddyfile");
const rootEnv = readRepoFile(".env.example");
const productionEnv = readRepoFile("infra/env.prod.example");
const turboConfig = readRepoFile("turbo.json");
const affiliateEnv = readRepoFile("apps/affiliate/.env.example");
const operatorGuide = readRepoFile("plans/affiliate-production.md");

test("builds a minimal non-root standalone affiliate image with an independent healthcheck", () => {
  const healthcheck = dockerfile
    .split("\n")
    .find((line) => line.startsWith("HEALTHCHECK"));

  assert.match(dockerfile, /FROM node:22\.13-bookworm-slim AS deps/);
  assert.match(dockerfile, /corepack prepare yarn@1\.22\.22 --activate/);
  assert.match(dockerfile, /yarn install --frozen-lockfile/);
  assert.match(dockerfile, /ARG NEXT_PUBLIC_SITE_URL=https:\/\/artmate\.ru/);
  assert.match(dockerfile, /RUN yarn workspace affiliate build/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(dockerfile, /EXPOSE 3006/);
  assert.ok(healthcheck);
  assert.match(healthcheck, /http:\/\/127\.0\.0\.1:3006\/health/);
  assert.match(healthcheck, /AbortSignal\.timeout\([1-9]\d*\)/);
  assert.match(healthcheck, /redirect:\s*['"]manual['"]/);
  assert.match(healthcheck, /status\s*!==\s*200/);
  assert.match(healthcheck, /JSON\.stringify/);
  assert.match(healthcheck, /\{\\?['"]status\\?['"]:\\?['"]ok\\?['"]\}/);
  assert.doesNotMatch(healthcheck, /node:net/);
  assert.doesNotMatch(dockerfile, /apps\/affiliate\/public/);
});

test("builds and publishes affiliate with a safe public URL at build time", () => {
  for (const workflow of [ciWorkflow, publishWorkflow]) {
    assert.match(workflow, /app: affiliate\s+dockerfile: apps\/affiliate\/Dockerfile/);
    assert.match(
      workflow,
      /NEXT_PUBLIC_SITE_URL=\$\{\{ vars\.NEXT_PUBLIC_SITE_URL \|\| 'https:\/\/artmate\.ru' \}\}/,
    );
    assert.doesNotMatch(workflow, /secrets\.NEXT_PUBLIC_SITE_URL/);
  }
});

test("runs affiliate internally on the shared release tag and existing environment", () => {
  assert.match(
    compose,
    /affiliate:\s+image: ghcr\.io\/denisvorop\/artmate-monorepo-affiliate:\$\{IMAGE_TAG:-latest\}[\s\S]+?PORT: 3006[\s\S]+?API_BASE_URL:[^\n]+[\s\S]+?AUTH_COOKIE_DOMAIN:[^\n]+[\s\S]+?NEXT_PUBLIC_SITE_URL:[^\n]+[\s\S]+?depends_on:\s+- api/,
  );
  assert.doesNotMatch(compose, /affiliate:[\s\S]*?ports:\s+- ["']?3006:3006/);
  assert.match(compose, /caddy:[\s\S]+?depends_on:[\s\S]+?- affiliate/);
});

test("proxies only the canonical affiliate host with security and no-index headers", () => {
  assert.match(
    caddyfile,
    /affiliate\.artmate\.ru \{[\s\S]+?import security_headers[\s\S]+?X-Robots-Tag "noindex, nofollow, noarchive"[\s\S]+?encode zstd gzip[\s\S]+?reverse_proxy affiliate:3006[\s\S]+?import proxy_headers/,
  );
  assert.doesNotMatch(caddyfile, /affiliate\.art-mate\.ru/);
});

test("reloads Caddy and blocks deployment success until affiliate is healthy", () => {
  const migration = deployWorkflow.indexOf("--profile migrate run --rm api-migrate");
  const services = deployWorkflow.indexOf("up -d --remove-orphans --wait");
  const reload = deployWorkflow.indexOf(
    "-f docker-compose.prod.yml exec -T caddy caddy reload --config /etc/caddy/Caddyfile",
  );
  const healthSmoke = deployWorkflow.indexOf("http://127.0.0.1:3006/health");
  const loginSmoke = deployWorkflow.indexOf("http://127.0.0.1:3006/login");
  const healthProbe = deployWorkflow.slice(healthSmoke, loginSmoke);
  const loginProbe = deployWorkflow.slice(loginSmoke);

  assert.ok(migration >= 0);
  assert.ok(services > migration);
  assert.ok(reload > services);
  assert.ok(healthSmoke > reload);
  assert.ok(loginSmoke > healthSmoke);
  for (const probe of [healthProbe, loginProbe]) {
    assert.match(probe, /redirect:\s*\\?"manual\\?"/);
    assert.match(probe, /AbortSignal\.timeout\([1-9]\d*\)/);
    assert.match(probe, /response\.status/);
    assert.match(probe, /\b200\b/);
    assert.doesNotMatch(probe, /response\.ok/);
  }
});

test("documents the existing environment path without adding affiliate secrets", () => {
  for (const envFile of [rootEnv, productionEnv, affiliateEnv]) {
    assert.match(envFile, /API_BASE_URL=/);
    assert.match(envFile, /AUTH_COOKIE_DOMAIN=/);
    assert.match(envFile, /NEXT_PUBLIC_SITE_URL=/);
  }
  assert.doesNotMatch(rootEnv, /art-mate\.ru/);
  assert.match(turboConfig, /"NEXT_PUBLIC_SITE_URL"/);
  assert.match(operatorGuide, /affiliate\.artmate\.ru/);
  assert.match(operatorGuide, /DNS|TLS/);
  assert.match(operatorGuide, /rollback|откат/i);
  assert.match(operatorGuide, /миграц/i);
  assert.match(operatorGuide, /PRODUCTION_ENV_FILE/);
  assert.match(operatorGuide, /не является[^.\n]*workflow input/i);
  assert.match(operatorGuide, /vars\.NEXT_PUBLIC_SITE_URL/);
  assert.match(operatorGuide, /pre-affiliate|до появления affiliate/i);
  assert.doesNotMatch(operatorGuide, /production (проверен|verified)/i);
});
