import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CART_ITEM_MAX_QUANTITY } from "./cart.constants";
import { CartStorage } from "./cart.storage";
import { ProductsService } from "../products/products.service";
import type {
  AddCartItemRequestDTO,
  CartDTO,
  CartItemDTO,
  CartProductDTO,
  UpdateCartItemRequestDTO,
} from "./dto";

const MAX_QUANTITY = CART_ITEM_MAX_QUANTITY;

@Injectable()
export class CartService {
  constructor(
    private readonly cartStorage: CartStorage,
    private readonly productsService: ProductsService,
  ) {}

  async getCart(cartId?: string): Promise<CartDTO> {
    const cart = await this.cartStorage.ensureCart(cartId);

    return this.withOzonDeliveryAvailability(this.cartStorage.getDTO(cart));
  }

  async addItem(
    cartId: string | undefined,
    request: AddCartItemRequestDTO,
  ): Promise<CartDTO> {
    const product = this.parseProduct(
      await this.productsService.getCartProductSnapshot(request.productId),
    );
    const quantity = this.parseQuantity(request.quantity ?? 1);
    const cart = await this.cartStorage.addItem(
      cartId,
      product,
      quantity,
      MAX_QUANTITY,
    );

    return this.withOzonDeliveryAvailability(this.cartStorage.getDTO(cart));
  }

  async updateItem(
    cartId: string | undefined,
    productId: string,
    request: UpdateCartItemRequestDTO,
  ) {
    const cart = await this.cartStorage.updateItemQuantity(
      cartId,
      productId,
      this.parseQuantity(request.quantity),
    );

    if (!cart) {
      throw new NotFoundException("Cart item not found");
    }

    return this.withOzonDeliveryAvailability(this.cartStorage.getDTO(cart));
  }

  async removeItem(cartId: string | undefined, productId: string) {
    const cart = await this.cartStorage.removeItem(cartId, productId);

    return this.withOzonDeliveryAvailability(this.cartStorage.getDTO(cart));
  }

  async clearCart(cartId?: string) {
    const cart = await this.cartStorage.clearCart(cartId);

    return this.withOzonDeliveryAvailability(this.cartStorage.getDTO(cart));
  }

  async assertItemsInStock(items: readonly CartItemDTO[]) {
    await this.productsService.assertProductsInStock(items.map((item) => item.id));
  }

  private async withOzonDeliveryAvailability(
    cart: Omit<CartDTO, "isOzonDeliveryAvailable">,
  ): Promise<CartDTO> {
    return {
      ...cart,
      isOzonDeliveryAvailable:
        cart.items.length > 0 &&
        (await this.productsService.areProductsOzonDeliveryAvailable(
          cart.items.map((item) => item.id),
        )),
    };
  }

  private parseProduct(product: CartProductDTO): CartProductDTO {
    if (!product || typeof product !== "object") {
      throw new BadRequestException("Product is required");
    }

    const parsedProduct = {
      id: this.parseRequiredString(product.id, "product.id"),
      title: this.parseRequiredString(product.title, "product.title"),
      slug: this.parseRequiredString(product.slug, "product.slug"),
      category: this.parseOptionalString(product.category),
      categorySlug: this.parseOptionalString(product.categorySlug),
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

  private parseOptionalString(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  private parsePrice(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException(
        "product.price must be a non-negative number",
      );
    }

    return value;
  }

  private parseQuantity(value: unknown): number {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > MAX_QUANTITY
    ) {
      throw new BadRequestException(
        `quantity must be an integer between 1 and ${MAX_QUANTITY}`,
      );
    }

    return value;
  }
}
