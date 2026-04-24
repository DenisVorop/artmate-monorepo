import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { CartStorage } from "./cart.storage";
import type {
  AddCartItemRequestDTO,
  CartDTO,
  CartProductDTO,
  UpdateCartItemRequestDTO,
} from "./dto/cart.dto";

const MAX_QUANTITY = 99;

@Injectable()
export class CartService {
  constructor(private readonly cartStorage: CartStorage) {}

  getCart(cartId?: string): CartDTO {
    const cart = this.cartStorage.ensureCart(cartId);

    return this.cartStorage.getDTO(cart);
  }

  addItem(cartId: string | undefined, request: AddCartItemRequestDTO): CartDTO {
    const cart = this.cartStorage.ensureCart(cartId);
    const product = this.parseProduct(request.product);
    const quantity = this.parseQuantity(request.quantity ?? 1);
    const existingItem = cart.items.get(product.id);

    cart.items.set(product.id, {
      product,
      quantity: Math.min((existingItem?.quantity ?? 0) + quantity, MAX_QUANTITY),
    });

    return this.cartStorage.getDTO(cart);
  }

  updateItem(cartId: string | undefined, productId: string, request: UpdateCartItemRequestDTO) {
    const cart = this.cartStorage.ensureCart(cartId);
    const existingItem = cart.items.get(productId);

    if (!existingItem) {
      throw new NotFoundException("Cart item not found");
    }

    cart.items.set(productId, {
      ...existingItem,
      quantity: this.parseQuantity(request.quantity),
    });

    return this.cartStorage.getDTO(cart);
  }

  removeItem(cartId: string | undefined, productId: string) {
    const cart = this.cartStorage.ensureCart(cartId);
    cart.items.delete(productId);

    return this.cartStorage.getDTO(cart);
  }

  clearCart(cartId?: string) {
    const cart = this.cartStorage.ensureCart(cartId);
    cart.items.clear();

    return this.cartStorage.getDTO(cart);
  }

  private parseProduct(product: CartProductDTO): CartProductDTO {
    if (!product || typeof product !== "object") {
      throw new BadRequestException("Product is required");
    }

    const parsedProduct = {
      id: this.parseRequiredString(product.id, "product.id"),
      title: this.parseRequiredString(product.title, "product.title"),
      slug: this.parseRequiredString(product.slug, "product.slug"),
      category: this.parseRequiredString(product.category, "product.category"),
      categorySlug: this.parseRequiredString(product.categorySlug, "product.categorySlug"),
      image: this.parseRequiredString(product.image, "product.image"),
      price: this.parsePrice(product.price),
    };

    return parsedProduct;
  }

  private parseRequiredString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }

    return value.trim();
  }

  private parsePrice(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException("product.price must be a non-negative number");
    }

    return value;
  }

  private parseQuantity(value: unknown): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_QUANTITY) {
      throw new BadRequestException(`quantity must be an integer between 1 and ${MAX_QUANTITY}`);
    }

    return value;
  }
}
