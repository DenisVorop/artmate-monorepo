export type DeviceType = "mobile" | "tablet" | "desktop";

export type DeviceInfo = {
  readonly device: DeviceType;
  readonly isMobile: boolean;
  readonly isTablet: boolean;
  readonly isDesktop: boolean;
  readonly isApple: boolean;
};

type RequestHeaders = {
  get(_name: string): string | null;
};

export const tabletMinWidthPx = 425;
export const desktopMinWidthPx = 768;

const desktopUserAgentPattern = /Windows NT|Macintosh|X11|CrOS|Linux x86_64|Linux i[0-9]86/i;
const appleUserAgentPattern = /iPhone|iPad|iPod|Macintosh|Mac OS X/i;
const iosTabletUserAgentPattern = /iPad|Macintosh.+Mobile/i;
const androidTabletUserAgentPattern = /Android(?!.*Mobile)/i;
const tabletUserAgentPattern = /Tablet|Kindle|Silk|PlayBook|Nexus 7|Nexus 9|SM-T/i;
const knownMobileUserAgentPattern =
  /Android|BlackBerry|IEMobile|iPhone|iPod|Mobile|Opera Mini|webOS/i;
const applePlatformPattern = /iOS|iPadOS|macOS/i;

const deviceInfoCache = new Map<string, DeviceInfo>();

export const fallbackDeviceInfo = createDeviceInfo("mobile", false);

export function getDeviceTypeFromViewportWidth(width: number): DeviceType {
  if (width >= desktopMinWidthPx) return "desktop";
  if (width >= tabletMinWidthPx) return "tablet";

  return "mobile";
}

export function createDeviceInfo(device: DeviceType, isApple: boolean) {
  const cacheKey = `${device}:${isApple ? "apple" : "other"}`;
  const cached = deviceInfoCache.get(cacheKey);

  if (cached) return cached;

  const deviceInfo = {
    device,
    isMobile: device === "mobile" || device === "tablet",
    isTablet: device === "tablet",
    isDesktop: device === "desktop",
    isApple,
  } satisfies DeviceInfo;

  deviceInfoCache.set(cacheKey, deviceInfo);

  return deviceInfo;
}

function normalizeClientHint(value: string | null) {
  return value?.replaceAll('"', "").trim() ?? "";
}

function isAppleDevice(userAgent: string, platformHint = "") {
  return appleUserAgentPattern.test(userAgent) || applePlatformPattern.test(platformHint);
}

function isTabletUserAgent(userAgent: string) {
  return (
    iosTabletUserAgentPattern.test(userAgent) ||
    androidTabletUserAgentPattern.test(userAgent) ||
    tabletUserAgentPattern.test(userAgent)
  );
}

function isDesktopUserAgent(userAgent: string) {
  return (
    desktopUserAgentPattern.test(userAgent) &&
    !isTabletUserAgent(userAgent) &&
    !knownMobileUserAgentPattern.test(userAgent)
  );
}

export function getDeviceInfoFromUserAgent(
  userAgent: string | null | undefined,
  platformHint?: string | null,
) {
  const normalizedUserAgent = userAgent ?? "";
  const normalizedPlatformHint = normalizeClientHint(platformHint ?? null);
  const isApple = isAppleDevice(normalizedUserAgent, normalizedPlatformHint);

  if (isTabletUserAgent(normalizedUserAgent)) {
    return createDeviceInfo("tablet", isApple);
  }

  if (isDesktopUserAgent(normalizedUserAgent)) {
    return createDeviceInfo("desktop", isApple);
  }

  return createDeviceInfo("mobile", isApple);
}

export function getDeviceInfoFromRequest(headers: RequestHeaders) {
  const deviceInfo = getDeviceInfoFromUserAgent(
    headers.get("user-agent"),
    headers.get("sec-ch-ua-platform"),
  );

  if (headers.get("sec-ch-ua-mobile") === "?1" && deviceInfo.isDesktop) {
    return createDeviceInfo("mobile", deviceInfo.isApple);
  }

  return deviceInfo;
}
