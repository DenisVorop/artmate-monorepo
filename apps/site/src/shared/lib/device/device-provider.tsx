"use client";

import type { ReactNode } from "react";

import { DeviceInfoContext } from "./device.context";
import type { DeviceInfo } from "./device-info";

type DeviceProviderProps = {
  readonly children?: ReactNode;
  readonly initialDeviceInfo: DeviceInfo;
};

export function DeviceProvider({ children, initialDeviceInfo }: DeviceProviderProps) {
  return (
    <DeviceInfoContext.Provider value={initialDeviceInfo}>{children}</DeviceInfoContext.Provider>
  );
}
