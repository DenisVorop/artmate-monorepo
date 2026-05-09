import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

const defaultPort = 3005;
const defaultOpenAiBaseUrl = "https://api.openai.com/v1";
const maxBodySizeBytes = 2 * 1024 * 1024;
const requestTimeoutMs = 180_000;

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(getPort(), () => {
  console.log(`Edge proxy listening on port ${getPort()}`);
});

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  try {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const pathname = getPathname(request);

    if (!isAllowedPath(pathname)) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    const relayToken = getRequiredEnv("EDGE_PROXY_TOKEN", "AI_RELAY_TOKEN");
    const authorization = request.headers.authorization;

    if (authorization !== `Bearer ${relayToken}`) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }

    const body = await readRequestBody(request);
    const upstreamResponse = await forwardToOpenAi(pathname, body);
    const upstreamBody = Buffer.from(await upstreamResponse.arrayBuffer());

    response.writeHead(
      upstreamResponse.status,
      getForwardedResponseHeaders(upstreamResponse),
    );
    response.end(upstreamBody);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown relay error";
    const status = message.includes("too large") ? 413 : 500;

    sendJson(response, status, { error: message });
  }
}

async function forwardToOpenAi(pathname: string, body: Buffer) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(
      `${getOpenAiBaseUrl()}${normalizeOpenAiPath(pathname)}`,
      {
        body: toArrayBuffer(body),
        headers: {
          authorization: `Bearer ${getRequiredEnv("OPENAI_API_KEY")}`,
          "content-type": "application/json",
          ...getOptionalOpenAiHeaders(),
        },
        method: "POST",
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bodySize = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bodySize += buffer.length;

    if (bodySize > maxBodySizeBytes) {
      throw new Error("Request body is too large");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function getPathname(request: IncomingMessage) {
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url ?? "/", `http://${host}`);

  return url.pathname;
}

function isAllowedPath(pathname: string) {
  return pathname === "/responses" || pathname === "/v1/responses";
}

function normalizeOpenAiPath(pathname: string) {
  return pathname.startsWith("/v1/") ? pathname.slice(3) : pathname;
}

function getOpenAiBaseUrl() {
  return (process.env.OPENAI_BASE_URL ?? defaultOpenAiBaseUrl).replace(
    /\/$/,
    "",
  );
}

function getOptionalOpenAiHeaders() {
  return {
    ...(process.env.OPENAI_ORGANIZATION
      ? { "openai-organization": process.env.OPENAI_ORGANIZATION }
      : {}),
    ...(process.env.OPENAI_PROJECT
      ? { "openai-project": process.env.OPENAI_PROJECT }
      : {}),
  };
}

function getForwardedResponseHeaders(upstreamResponse: Response) {
  const headers: Record<string, string> = {};
  const forwardedHeaders = [
    "content-type",
    "openai-organization",
    "openai-processing-ms",
    "openai-version",
    "x-request-id",
    "x-ratelimit-limit-requests",
    "x-ratelimit-limit-tokens",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-remaining-tokens",
    "x-ratelimit-reset-requests",
    "x-ratelimit-reset-tokens",
  ];

  for (const headerName of forwardedHeaders) {
    const value = upstreamResponse.headers.get(headerName);

    if (value) {
      headers[headerName] = value;
    }
  }

  return headers;
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  response.writeHead(status, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(body));
}

function getRequiredEnv(name: string, fallbackName?: string) {
  const value =
    process.env[name]?.trim() ??
    (fallbackName ? process.env[fallbackName]?.trim() : undefined);

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getPort() {
  const value = process.env.PORT;

  if (!value) {
    return defaultPort;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 0 || port >= 65536) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}
