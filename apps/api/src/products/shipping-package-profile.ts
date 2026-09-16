import { BadRequestException } from "@nestjs/common";

/** One ready-to-ship, individually packed product unit. */
export type ShippingPackageProfile = {
  id: string;
  code: string;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type ShippingPackageSnapshot = ShippingPackageProfile & { version: 1 };

export function createShippingPackageSnapshot(
  profile: ShippingPackageProfile,
): ShippingPackageSnapshot {
  return { version: 1, ...parseShippingPackageProfile(profile) };
}

export function parseShippingPackageSnapshot(
  value: unknown,
): ShippingPackageSnapshot {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("version" in value) ||
    value.version !== 1
  ) {
    throw new BadRequestException({
      code: "SHIPPING_PACKAGE_SNAPSHOT_INVALID",
      message: "В заказе отсутствуют корректные параметры упаковки для СДЭК.",
    });
  }

  return { version: 1, ...parseShippingPackageProfile(value) };
}

const packageFields = [
  "weightGrams",
  "lengthCm",
  "widthCm",
  "heightCm",
] as const;
const maxDatabaseInteger = 2_147_483_647;

export function parseShippingPackageProfile(
  value: unknown,
): ShippingPackageProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidProfile("profile");
  }

  const profile = value as Record<string, unknown>;
  if (
    typeof profile.id !== "string" ||
    !profile.id.trim() ||
    profile.id !== profile.id.trim() ||
    profile.id.length > 32
  ) {
    throw invalidProfile("id");
  }
  if (
    typeof profile.code !== "string" ||
    profile.code !== profile.code.trim() ||
    !/^[a-z][a-z0-9_-]{0,63}$/.test(profile.code)
  ) {
    throw invalidProfile("code");
  }

  for (const field of packageFields) {
    const dimension = profile[field];
    if (
      typeof dimension !== "number" ||
      !Number.isInteger(dimension) ||
      dimension <= 0 ||
      dimension > maxDatabaseInteger
    ) {
      throw invalidProfile(field);
    }
  }

  // Copy only validated fields; no price, characteristics or provider defaults.
  return {
    id: profile.id,
    code: profile.code,
    weightGrams: profile.weightGrams as number,
    lengthCm: profile.lengthCm as number,
    widthCm: profile.widthCm as number,
    heightCm: profile.heightCm as number,
  };
}

function invalidProfile(field: string) {
  return new BadRequestException({
    code: "SHIPPING_PACKAGE_PROFILE_INVALID",
    message: "Некорректные параметры упаковки товара.",
    field,
  });
}
