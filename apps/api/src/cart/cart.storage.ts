import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import type { CartDTO, CartItemDTO, CartProductDTO } from "./dto/cart.dto";

type StoredCartItem = {
  product: CartProductDTO;
  quantity: number;
};

type StoredCart = {
  id: string;
  items: Map<string, StoredCartItem>;
};

@Injectable()
export class CartStorage {
  private readonly carts = new Map<string, StoredCart>();

  ensureCart(cartId?: string) {
    const normalizedCartId = this.normalizeCartId(cartId);

    if (normalizedCartId) {
      const existingCart = this.carts.get(normalizedCartId);

      if (existingCart) {
        return existingCart;
      }

      const cart = this.createCart(normalizedCartId);
      this.carts.set(cart.id, cart);
      return cart;
    }

    const cart = this.createCart();
    this.carts.set(cart.id, cart);
    return cart;
  }

  getDTO(cart: StoredCart): CartDTO {
    const items = [...cart.items.values()].map<CartItemDTO>(({ product, quantity }) => ({
      ...product,
      quantity,
      lineTotal: product.price * quantity,
    }));
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

  private createCart(id: string = randomUUID()): StoredCart {
    return {
      id,
      items: new Map(),
    };
  }

  private normalizeCartId(cartId?: string) {
    const value = cartId?.trim();

    if (!value || value.length > 128) {
      return undefined;
    }

    return value;
  }
}
