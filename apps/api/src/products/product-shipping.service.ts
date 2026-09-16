import { BadRequestException, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

import {
  parseShippingPackageProfile,
  type ShippingPackageProfile,
} from "./shipping-package-profile";

@Injectable()
export class ProductShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForProducts(
    productIds: readonly string[],
  ): Promise<Map<string, ShippingPackageProfile>> {
    const uniqueIds = [...new Set(productIds)];
    if (uniqueIds.length === 0) return new Map();

    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        shippingPackageProfile: {
          select: {
            id: true,
            code: true,
            weightGrams: true,
            lengthCm: true,
            widthCm: true,
            heightCm: true,
          },
        },
      },
    });
    const profilesByProductId = new Map(
      products.map((product) => [product.id, product.shippingPackageProfile]),
    );
    const missingProductIds = uniqueIds.filter(
      (id) => !profilesByProductId.get(id),
    );

    if (missingProductIds.length > 0) {
      throw new BadRequestException({
        code: "SHIPPING_PACKAGE_PROFILE_MISSING",
        message: "Для части товаров не настроена упаковка для доставки СДЭК.",
        productIds: missingProductIds,
      });
    }

    return new Map(
      uniqueIds.map((id) => [
        id,
        parseShippingPackageProfile(profilesByProductId.get(id)),
      ]),
    );
  }
}
