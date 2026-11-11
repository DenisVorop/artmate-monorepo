import { isIP } from "node:net";
import Bowser from "bowser";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import type { AdvertisingConsentDevice } from "./contracts/consent-decision.contract";

export function advertisingTechnicalEvidence(
  context: RequestEvidenceV1,
  device?: AdvertisingConsentDevice,
) {
  const headers = context.upstream?.headers ?? context.headers;
  const userAgent = headers["user-agent"]?.[0] ?? "";
  const { browser, os } = userAgent ? Bowser.parse(userAgent) : {};
  const brand = browserBrand(browser?.name);
  const fullVersion = device?.browserVersions?.find(
    (item) => browserBrand(item.brand) === brand,
  )?.version;
  const clientIp = context.client.ipAddress;

  return {
    clientIpAddress:
      context.client.forwardedHeadersTrusted && clientIp && isIP(clientIp)
        ? clientIp
        : null,
    clientTimeZone: device?.timeZone ?? null,
    clientUtcOffsetMinutes: device?.utcOffsetMinutes ?? null,
    browserName: browser?.name?.slice(0, 64) ?? null,
    browserVersion:
      fullVersion ??
      browser?.version?.replace(/^(\d+)\.0\.0\.0$/, "$1").slice(0, 64) ??
      null,
    osName: os?.name?.slice(0, 64) ?? null,
    osVersion: operatingSystemVersion(os, userAgent, device?.platformVersion),
  };
}

function browserBrand(name?: string) {
  return name?.toLowerCase().replace(/^(google|microsoft) /, "").replace(/ browser$/, "");
}

function operatingSystemVersion(
  os: { name?: string; version?: string } | undefined,
  userAgent: string,
  platformVersion?: string,
) {
  if (os?.name === "Windows" && /Windows NT 10\.0\b/.test(userAgent)) {
    // UA reports Windows NT 10.0 for both Windows 10 and 11.
    const contract = Number(platformVersion?.split(".")[0]);
    if (contract >= 13) return "11+";
    return contract >= 1 && contract <= 10 ? "10" : null;
  }
  if (os?.name && platformVersion && platformVersion !== "0.0.0") {
    return platformVersion;
  }
  // Common frozen versions in reduced User-Agent strings.
  if (/Mac OS X 10[_.]15[_.]7\b|Android 10; K\b/.test(userAgent)) return null;
  return os?.version?.slice(0, 64) ?? null;
}
