/* global process */

import path from "node:path";
import { fileURLToPath } from "node:url";

const legacyPdfJsBuild = "pdfjs-dist/legacy/build/pdf.mjs";
const apiImageRemotePattern = getApiImageRemotePattern();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [
      apiImageRemotePattern,
      {
        protocol: "https",
        hostname: "api.artmate.ru",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "api.art-mate.ru",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "basket-20.wbbasket.ru",
      },
      {
        protocol: "https",
        hostname: "basket-21.wbbasket.ru",
      },
      {
        protocol: "https",
        hostname: "basket-24.wbbasket.ru",
      },
      {
        protocol: "https",
        hostname: "basket-27.wbbasket.ru",
      },
      {
        protocol: "https",
        hostname: "basket-28.wbbasket.ru",
      },
      {
        protocol: "https",
        hostname: "basket-30.wbbasket.ru",
      },
      {
        protocol: "https",
        hostname: "basket-35.wbbasket.ru",
      },
      {
        protocol: "https",
        hostname: "basket-41.wbbasket.ru",
      },
      {
        protocol: "https",
        hostname: "cdn1.ozone.ru",
      },
      {
        protocol: "https",
        hostname: "cdn2.ozone.ru",
      },
      {
        protocol: "https",
        hostname: "cdn3.ozone.ru",
      },
      {
        protocol: "https",
        hostname: "cdn4.ozone.ru",
      },
      {
        protocol: "https",
        hostname: "ir.ozone.ru",
      },
    ],
  },
  turbopack: {
    resolveAlias: {
      "pdfjs-dist": legacyPdfJsBuild,
    },
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  webpack(config) {
    config.resolve.alias["pdfjs-dist$"] = legacyPdfJsBuild;

    const fileLoaderRule = config.module.rules.find((rule) => rule.test?.test?.(".svg"));

    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: {
          not: [...fileLoaderRule.resourceQuery.not, /url/],
        },
        use: ["@svgr/webpack"],
      },
    );

    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

export default nextConfig;

function getApiImageRemotePattern() {
  const fallbackUrl = "http://localhost:3002";
  const rawUrl = process.env.API_PUBLIC_URL ?? process.env.API_BASE_URL ?? fallbackUrl;

  try {
    const url = new URL(rawUrl);

    return {
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
      port: url.port || undefined,
      pathname: "/uploads/**",
    };
  } catch {
    return {
      protocol: "http",
      hostname: "localhost",
      port: "3002",
      pathname: "/uploads/**",
    };
  }
}
