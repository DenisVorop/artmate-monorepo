import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import {
  CreateProductImageRequestDTO,
  CreateProductRequestDTO,
  ProductDTO,
  ProductImageDTO,
  UpdateProductImageRequestDTO,
  UpdateProductRequestDTO,
} from "./dto";
import {
  maxProductImageSizeBytes,
  ProductsService,
  type UploadedProductFile,
} from "./products.service";

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Products")
@UseGuards(AuthGuard)
@Controller("products")
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(ProductDTO, { isArray: true })
  @ApiOperation({ summary: "List products for admin panel" })
  @ApiOkResponse({ type: [ProductDTO] })
  @Get()
  getProducts(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.getAdminProducts();
  }

  @ValidateResponse(ProductDTO)
  @ApiOperation({ summary: "Get product for admin panel" })
  @ApiOkResponse({ type: ProductDTO })
  @Get(":id")
  getProduct(
    @Param("id") productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.getAdminProduct(productId);
  }

  @ValidateResponse(ProductDTO)
  @ApiOperation({ summary: "Create product from admin panel" })
  @ApiCreatedResponse({ type: ProductDTO })
  @Post()
  createProduct(
    @Body() body: CreateProductRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.createProduct(body);
  }

  @ValidateResponse(ProductDTO)
  @ApiOperation({ summary: "Update product from admin panel" })
  @ApiOkResponse({ type: ProductDTO })
  @Patch(":id")
  updateProduct(
    @Param("id") productId: string,
    @Body() body: UpdateProductRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.updateProduct(productId, body);
  }

  @ValidateResponse(ProductDTO)
  @ApiOperation({ summary: "Delete product from admin panel" })
  @ApiOkResponse({ type: ProductDTO })
  @Delete(":id")
  deleteProduct(
    @Param("id") productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.deleteProduct(productId);
  }

  @ValidateResponse(ProductImageDTO)
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload product image from admin panel" })
  @ApiCreatedResponse({ type: ProductImageDTO })
  @Post(":id/images")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: maxProductImageSizeBytes,
      },
    }),
  )
  addProductImage(
    @Param("id") productId: string,
    @UploadedFile() file: UploadedProductFile | undefined,
    @Body() body: CreateProductImageRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.addProductImage(productId, file, body.alt);
  }

  @ValidateResponse(ProductImageDTO)
  @ApiOperation({ summary: "Update product image from admin panel" })
  @ApiOkResponse({ type: ProductImageDTO })
  @Patch(":productId/images/:imageId")
  updateProductImage(
    @Param("productId") productId: string,
    @Param("imageId") imageId: string,
    @Body() body: UpdateProductImageRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.updateProductImage(productId, imageId, body);
  }

  @ValidateResponse(ProductImageDTO)
  @ApiOperation({ summary: "Delete product image from admin panel" })
  @ApiOkResponse({ type: ProductImageDTO })
  @Delete(":productId/images/:imageId")
  deleteProductImage(
    @Param("productId") productId: string,
    @Param("imageId") imageId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.deleteProductImage(productId, imageId);
  }
}

@ApiTags("Products")
@Controller("catalog/products")
export class CatalogProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ValidateResponse(ProductDTO, { isArray: true })
  @ApiOperation({ summary: "List published products" })
  @ApiOkResponse({ type: [ProductDTO] })
  @Get()
  getProducts() {
    return this.productsService.getPublishedProducts();
  }

  @ValidateResponse(ProductDTO)
  @ApiOperation({ summary: "Get published product by slug" })
  @ApiOkResponse({ type: ProductDTO })
  @Get(":slug")
  getProduct(@Param("slug") slug: string) {
    return this.productsService.getPublishedProductBySlug(slug);
  }
}
