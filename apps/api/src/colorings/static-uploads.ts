import { posix } from "node:path";

import type { NestExpressApplication } from "@nestjs/platform-express";

type StaticResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): StaticResponse;
  json(body: unknown): void;
};

type StaticRequest = {
  path: string;
};

const blockColoringUploads = (
  request: StaticRequest,
  response: StaticResponse,
  next: () => void,
) => {
  const rawPath = request.path;
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(rawPath).replaceAll("\\", "/");
  } catch {
    if (/^\/uploads(?:[/%\\]|$)/i.test(rawPath)) {
      sendNotFound(response);
    } else {
      next();
    }
    return;
  }

  const canonicalPath = posix.normalize(decodedPath).toLowerCase();

  if (
    canonicalPath !== "/uploads/colorings" &&
    !canonicalPath.startsWith("/uploads/colorings/")
  ) {
    next();
    return;
  }

  sendNotFound(response);
};

function sendNotFound(response: StaticResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.status(404).json({ statusCode: 404, message: "Not Found" });
}

export function configureStaticUploads(
  app: NestExpressApplication,
  uploadsRoot: string,
) {
  app.use(blockColoringUploads);
  app.useStaticAssets(uploadsRoot, { prefix: "/uploads/" });
}
