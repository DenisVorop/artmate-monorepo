"use client";

import { useDeviceInfo } from "./use-device-info";

export function useIsMobile() {
  return useDeviceInfo().isMobile;
}
