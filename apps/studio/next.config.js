/* global process */
import path from "node:path";
import { fileURLToPath } from "node:url";
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/api/studio/:path*",
        destination: "http://127.0.0.1:8000/api/studio/:path*",
      },
    ];
  },
};
