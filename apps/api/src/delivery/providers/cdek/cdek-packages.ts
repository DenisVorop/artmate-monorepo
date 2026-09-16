import { BadRequestException } from "@nestjs/common";

import { parseShippingPackageSnapshot } from "../../../products/shipping-package-profile";
import type { DeliveryCartItem } from "../delivery-provider.interface";

const maxOrderPackageCount = 255;

/** CDEK receives one individually packed product unit per package. */
export function buildCdekPackages(items: DeliveryCartItem[]) {
  if (items.length === 0) {
    throw new BadRequestException("CDEK order packages are empty");
  }

  let packageCount = 0;
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new BadRequestException(
        "CDEK item quantity must be a positive integer",
      );
    }

    packageCount += item.quantity;
    if (packageCount > maxOrderPackageCount) {
      throw new BadRequestException(
        `CDEK order packages count must be ${maxOrderPackageCount} or less`,
      );
    }
  }

  // Validate and copy every snapshot before expanding any quantity.
  const validatedItems = items.map((item) => ({
    item,
    shippingPackage: parseShippingPackageSnapshot(item.shippingPackage),
  }));

  return validatedItems.flatMap(({ item, shippingPackage }) =>
    Array.from({ length: item.quantity }, () => ({
      item,
      height: shippingPackage.heightCm,
      length: shippingPackage.lengthCm,
      weight: shippingPackage.weightGrams,
      width: shippingPackage.widthCm,
    })),
  );
}
