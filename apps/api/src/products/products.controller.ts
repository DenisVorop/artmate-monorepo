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
  CreateProductCategoryRequestDTO,
  CreateProductTagRequestDTO,
  ProductCategoryDTO,
  CreateProductRequestDTO,
  ProductDTO,
  ProductImageDTO,
  ProductTagDTO,
  UpdateProductCategoryRequestDTO,
  UpdateProductImageRequestDTO,
  UpdateProductRequestDTO,
  UpdateProductTagRequestDTO,
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

  @ValidateResponse(ProductCategoryDTO, { isArray: true })
  @ApiOperation({ summary: "List product categories for admin panel" })
  @ApiOkResponse({ type: [ProductCategoryDTO] })
  @Get("categories")
  getCategories(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.getAdminCategories();
  }

  @ValidateResponse(ProductCategoryDTO)
  @ApiOperation({ summary: "Create product category from admin panel" })
  @ApiCreatedResponse({ type: ProductCategoryDTO })
  @Post("categories")
  createCategory(
    @Body() body: CreateProductCategoryRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.createCategory(body);
  }

  @ValidateResponse(ProductCategoryDTO)
  @ApiOperation({ summary: "Update product category from admin panel" })
  @ApiOkResponse({ type: ProductCategoryDTO })
  @Patch("categories/:id")
  updateCategory(
    @Param("id") categoryId: string,
    @Body() body: UpdateProductCategoryRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.updateCategory(categoryId, body);
  }

  @ValidateResponse(ProductCategoryDTO)
  @ApiOperation({ summary: "Delete product category from admin panel" })
  @ApiOkResponse({ type: ProductCategoryDTO })
  @Delete("categories/:id")
  deleteCategory(
    @Param("id") categoryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.deleteCategory(categoryId);
  }

  @ValidateResponse(ProductTagDTO, { isArray: true })
  @ApiOperation({ summary: "List product tags for admin panel" })
  @ApiOkResponse({ type: [ProductTagDTO] })
  @Get("tags")
  getTags(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.getProductTags();
  }

  @ValidateResponse(ProductTagDTO)
  @ApiOperation({ summary: "Create product tag from admin panel" })
  @ApiCreatedResponse({ type: ProductTagDTO })
  @Post("tags")
  createTag(
    @Body() body: CreateProductTagRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.createProductTag(body);
  }

  @ValidateResponse(ProductTagDTO)
  @ApiOperation({ summary: "Update product tag from admin panel" })
  @ApiOkResponse({ type: ProductTagDTO })
  @Patch("tags/:id")
  updateTag(
    @Param("id") tagId: string,
    @Body() body: UpdateProductTagRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.updateProductTag(tagId, body);
  }

  @ValidateResponse(ProductTagDTO)
  @ApiOperation({ summary: "Delete product tag from admin panel" })
  @ApiOkResponse({ type: ProductTagDTO })
  @Delete("tags/:id")
  deleteTag(@Param("id") tagId: string, @Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.productsService.deleteProductTag(tagId);
  }

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

  @ValidateResponse(ProductCategoryDTO, { isArray: true })
  @ApiOperation({ summary: "List published product categories" })
  @ApiOkResponse({ type: [ProductCategoryDTO] })
  @Get("categories")
  getCategories() {
    return this.productsService.getPublishedCategories();
  }

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
