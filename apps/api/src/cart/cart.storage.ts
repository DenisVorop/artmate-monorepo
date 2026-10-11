import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  getProductPrice,
  readProductPrices,
} from "../products/product-pricing";

import type { CartDTO, CartItemDTO, CartProductDTO } from "./dto";

const cartInclude = {
  items: {
    orderBy: {
      createdAt: "asc",
    },
  },
} as const;

type StoredCart = Prisma.CartGetPayload<{
  include: typeof cartInclude;
}>;

type CartWithCurrentPrices = Omit<StoredCart, "items"> & {
  items: Array<
    StoredCart["items"][number] & {
      effectivePrice?: number;
      originalPrice?: number;
    }
  >;
};

@Injectable()
export class CartStorage {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCart(cartId?: string) {
    const normalizedCartId = this.normalizeCartId(cartId);
    const id = normalizedCartId ?? randomUUID();

    const cart = await this.prisma.cart.upsert({
      where: { id },
      create: { id },
      update: {},
      include: cartInclude,
    });

    return this.withCurrentPrices(cart, this.prisma);
  }

  async addItem(
    cartId: string | undefined,
    product: CartProductDTO,
    quantity: number,
    maxQuantity: number,
  ) {
    const cart = await this.ensureCart(cartId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockCart(tx, cart.id);
      const where = {
        cartId_productId: {
          cartId: cart.id,
          productId: product.id,
        },
      };
      const existingItem = await tx.cartItem.findUnique({ where });
      const nextQuantity = Math.min(
        (existingItem?.quantity ?? 0) + quantity,
        maxQuantity,
      );

      await tx.cartItem.upsert({
        where,
        create: {
          cartId: cart.id,
          productId: product.id,
          title: product.title,
          slug: product.slug,
          price: product.price,
          category: product.category ?? null,
          categorySlug: product.categorySlug ?? null,
          image: product.image,
          quantity: nextQuantity,
        },
        update: {
          title: product.title,
          slug: product.slug,
          price: product.price,
          category: product.category ?? null,
          categorySlug: product.categorySlug ?? null,
          image: product.image,
          quantity: nextQuantity,
        },
      });

      return this.touchAndGetCart(cart.id, tx);
    });
  }

  async updateItemQuantity(
    cartId: string | undefined,
    productId: string,
    quantity: number,
  ) {
    const cart = await this.ensureCart(cartId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockCart(tx, cart.id);
      const where = {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      };
      const existingItem = await tx.cartItem.findUnique({ where });

      if (!existingItem) return undefined;

      await tx.cartItem.update({ where, data: { quantity } });

      return this.touchAndGetCart(cart.id, tx);
    });
  }

  async removeItem(cartId: string | undefined, productId: string) {
    const cart = await this.ensureCart(cartId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockCart(tx, cart.id);
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });

      return this.touchAndGetCart(cart.id, tx);
    });
  }

  async clearCart(cartId?: string) {
    const cart = await this.ensureCart(cartId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockCart(tx, cart.id);
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return this.touchAndGetCart(cart.id, tx);
    });
  }

  getDTO(
    cart: CartWithCurrentPrices,
  ): Omit<CartDTO, "isOzonDeliveryAvailable" | "minimumDeliveryPrices"> {
    const items = cart.items.map<CartItemDTO>((item) => {
      const price = item.effectivePrice ?? this.toNumber(item.price);

      return {
        id: item.productId,
        title: item.title,
        slug: item.slug,
        price,
        originalPrice: item.originalPrice,
        category: item.category ?? undefined,
        categorySlug: item.categorySlug ?? undefined,
        image: item.image,
        quantity: item.quantity,
        lineTotal: price * item.quantity,
      };
    });
    const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    return {
      id: cart.id,
      items,
      itemsCount,
      subtotal,
      total: subtotal,
      currency: "RUB",
    };
  }

  private async touchAndGetCart(
    cartId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const cart = await client.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
      include: cartInclude,
    });

    return this.withCurrentPrices(cart, client);
  }

  private async withCurrentPrices(
    cart: StoredCart,
    client: Pick<Prisma.TransactionClient, "product"> | PrismaService,
  ): Promise<CartWithCurrentPrices> {
    const prices = await readProductPrices(
      client,
      cart.items.map((item) => item.productId),
    );

    return {
      ...cart,
      items: cart.items.map((item) => {
        const productPrices = prices.get(item.productId);

        if (!productPrices) return item;

        const hasSalePrice = productPrices.salePrice !== null;

        return {
          ...item,
          effectivePrice: getProductPrice(productPrices) / 100,
          originalPrice: hasSalePrice ? productPrices.price / 100 : undefined,
        };
      }),
    };
  }

  private lockCart(tx: Prisma.TransactionClient, cartId: string) {
    return tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "carts" WHERE "id" = ${cartId} FOR UPDATE`,
    );
  }

  private normalizeCartId(cartId?: string) {
    const value = cartId?.trim();

    if (!value || value.length > 128) {
      return undefined;
    }

    return value;
  }

  private toNumber(value: unknown) {
    return Number(value);
  }
}
