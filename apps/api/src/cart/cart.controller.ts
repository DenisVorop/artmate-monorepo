import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Res,
} from "@nestjs/common";

import { ValidateResponse } from "../common/response-validation.interceptor";

import { CartService } from "./cart.service";
import {
  AddCartItemRequestDTO,
  CartDTO,
  UpdateCartItemRequestDTO,
} from "./dto";

const CART_COOKIE_NAME = "cart_id";
const CART_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

type CookieResponse = {
  cookie: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      maxAge: number;
      path: string;
      sameSite: "lax";
      secure: boolean;
    },
  ) => void;
};

@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ValidateResponse(CartDTO)
  @Get()
  async getCart(
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const cart = await this.cartService.getCart(this.getCartId(cookieHeader));
    this.setCartCookie(response, cart.id);

    return cart;
  }

  @ValidateResponse(CartDTO)
  @Post("items")
  async addItem(
    @Body() request: AddCartItemRequestDTO,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const cart = await this.cartService.addItem(
      this.getCartId(cookieHeader),
      request,
    );
    this.setCartCookie(response, cart.id);

    return cart;
  }

  @ValidateResponse(CartDTO)
  @Patch("items/:productId")
  async updateItem(
    @Param("productId") productId: string,
    @Body() request: UpdateCartItemRequestDTO,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const cart = await this.cartService.updateItem(
      this.getCartId(cookieHeader),
      productId,
      request,
    );
    this.setCartCookie(response, cart.id);

    return cart;
  }

  @ValidateResponse(CartDTO)
  @Delete("items/:productId")
  async removeItem(
    @Param("productId") productId: string,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const cart = await this.cartService.removeItem(
      this.getCartId(cookieHeader),
      productId,
    );
    this.setCartCookie(response, cart.id);

    return cart;
  }

  @ValidateResponse(CartDTO)
  @Delete()
  async clearCart(
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const cart = await this.cartService.clearCart(this.getCartId(cookieHeader));
    this.setCartCookie(response, cart.id);

    return cart;
  }

  private getCartId(cookieHeader?: string) {
    if (!cookieHeader) {
      return undefined;
    }

    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const cartCookie = cookies.find((cookie) =>
      cookie.startsWith(`${CART_COOKIE_NAME}=`),
    );
    const rawCartId = cartCookie?.slice(CART_COOKIE_NAME.length + 1);

    if (!rawCartId) {
      return undefined;
    }

    return decodeURIComponent(rawCartId);
  }

  private setCartCookie(response: CookieResponse, cartId: string) {
    response.cookie(CART_COOKIE_NAME, cartId, {
      httpOnly: true,
      maxAge: CART_COOKIE_MAX_AGE_MS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}
