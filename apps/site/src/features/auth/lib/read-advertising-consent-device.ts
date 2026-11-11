import type { AdvertisingConsentDeviceDTO } from "@/shared/actions/auth";

type BrowserHints = Pick<AdvertisingConsentDeviceDTO, "platformVersion"> & {
  fullVersionList?: AdvertisingConsentDeviceDTO["browserVersions"];
};

type NavigatorWithHints = Navigator & {
  userAgentData?: { getHighEntropyValues?: (_hints: string[]) => Promise<BrowserHints> };
};

export async function readAdvertisingConsentDevice(): Promise<AdvertisingConsentDeviceDTO> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const utcOffsetMinutes = -new Date().getTimezoneOffset();
  const device: AdvertisingConsentDeviceDTO = {
    ...(/^[\w+/-]{1,64}$/.test(timeZone ?? "") ? { timeZone } : {}),
    ...(Math.abs(utcOffsetMinutes) <= 840 ? { utcOffsetMinutes } : {}),
  };

  const userAgentData = (window.navigator as NavigatorWithHints).userAgentData;
  if (!userAgentData?.getHighEntropyValues) return device;

  let timeout: number | undefined;
  try {
    const hints = await Promise.race([
      userAgentData.getHighEntropyValues(["fullVersionList", "platformVersion"]),
      new Promise<undefined>((resolve) => {
        timeout = window.setTimeout(resolve, 200);
      }),
    ]);
    const versionPattern = /^\d+(?:\.\d+){0,5}$/;
    if (
      hints?.platformVersion &&
      hints.platformVersion.length <= 32 &&
      versionPattern.test(hints.platformVersion)
    ) {
      device.platformVersion = hints.platformVersion;
    }
    const browserVersions = hints?.fullVersionList
      ?.filter(
        ({ brand, version }) =>
          /^[\w .-]{1,48}$/.test(brand) && version.length <= 32 && versionPattern.test(version),
      )
      .slice(0, 8);
    if (browserVersions?.length) device.browserVersions = browserVersions;
  } catch {
    // Client hints are optional and can be disabled by the browser.
  } finally {
    window.clearTimeout(timeout);
  }
  return device;
}
