"use client";

import { useContext, useSyncExternalStore } from "react";

import { DeviceInfoContext } from "./device.context";
import {
  createDeviceInfo,
  desktopMinWidthPx,
  getDeviceInfoFromUserAgent,
  getDeviceTypeFromViewportWidth,
  tabletMinWidthPx,
} from "./device-info";

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
};

function isIosDevice() {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function subscribe(callback: () => void) {
  const tabletMediaQuery = window.matchMedia(`(min-width: ${tabletMinWidthPx}px)`);
  const desktopMediaQuery = window.matchMedia(`(min-width: ${desktopMinWidthPx}px)`);

  tabletMediaQuery.addEventListener("change", callback);
  desktopMediaQuery.addEventListener("change", callback);

  return () => {
    tabletMediaQuery.removeEventListener("change", callback);
    desktopMediaQuery.removeEventListener("change", callback);
  };
}

function getClientDeviceInfo() {
  const navigatorWithUserAgentData = navigator as NavigatorWithUserAgentData;
  const deviceInfo = getDeviceInfoFromUserAgent(
    navigator.userAgent,
    navigatorWithUserAgentData.userAgentData?.platform,
  );
  const device = getDeviceTypeFromViewportWidth(window.innerWidth);

  if (isIosDevice()) {
    return createDeviceInfo(device, true);
  }

  return createDeviceInfo(device, deviceInfo.isApple);
}

export function useDeviceInfo() {
  const initialDeviceInfo = useContext(DeviceInfoContext);

  return useSyncExternalStore(subscribe, getClientDeviceInfo, () => initialDeviceInfo);
}
