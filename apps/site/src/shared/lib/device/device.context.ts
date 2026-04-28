"use client";

import { createContext } from "react";

import { fallbackDeviceInfo, type DeviceInfo } from "./device-info";

export const DeviceInfoContext = createContext<DeviceInfo>(fallbackDeviceInfo);

DeviceInfoContext.displayName = "DeviceInfoContext";
