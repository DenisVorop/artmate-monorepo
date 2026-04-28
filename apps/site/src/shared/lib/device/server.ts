import "server-only";

import { headers } from "next/headers";

import { getDeviceInfoFromRequest } from "./device-info";

export async function getServerDeviceInfo() {
  const headerStore = await headers();

  return getDeviceInfoFromRequest(headerStore);
}
