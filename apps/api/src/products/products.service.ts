import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  Prisma,
  ProductStatus as PrismaProductStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type {
  CreateProductCategoryRequestDTO,
  CreateProductRequestDTO,
  UpdateProductCategoryRequestDTO,
  UpdateProductImageRequestDTO,
  UpdateProductRequestDTO,
} from "./dto";
import {
  productCurrencies,
  productImageMimeTypes,
  type ProductCurrency,
  type ProductImageMimeType,
  type ProductStatus,
} from "./products.types";

export type UploadedProductFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const productInclude = {
  category: true,
  images: {
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  },
} satisfies Prisma.ProductInclude;

const maxPriceRub = 21_474_836;
export const maxProductImageSizeBytes = 10 * 1024 * 1024;

type StoredProduct = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

type StoredProductCategory = {
  id: string;
  slug: string;
  title: string;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminCategories() {
    const categories = await this.prisma.productCategory.findMany({
      orderBy: {
        title: "asc",
      },
    });

    return categories.map((category) => this.mapProductCategory(category));
  }

  async getPublishedCategories() {
    const categories = await this.prisma.productCategory.findMany({
      where: {
        products: {
          some: {
            images: {
              some: {},
            },
            status: PrismaProductStatus.PUBLISHED,
          },
        },
      },
      orderBy: {
        title: "asc",
      },
    });

    return categories.map((category) => this.mapProductCategory(category));
  }

  async getAdminProducts() {
    const products = await this.prisma.product.findMany({
      include: productInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });

    return products.map((product) => this.mapProduct(product));
  }

  async getAdminProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return this.mapProduct(product);
  }

  async getPublishedProducts() {
    const products = await this.prisma.product.findMany({
      where: {
        images: {
          some: {},
        },
        status: PrismaProductStatus.PUBLISHED,
      },
      include: productInclude,
      orderBy: [
        {
          isHit: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    return products.map((product) => this.mapProduct(product));
  }

  async getPublishedProductBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        images: {
          some: {},
        },
        slug,
        status: PrismaProductStatus.PUBLISHED,
      },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return this.mapProduct(product);
  }

  async getCartProductSnapshot(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        images: {
          some: {},
        },
        status: PrismaProductStatus.PUBLISHED,
      },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const primaryImage = product.images[0];

    if (!primaryImage) {
      throw new NotFoundException("Product image not found");
    }

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      price: Math.trunc(product.price / 100),
      category: product.category.title,
      categorySlug: product.category.slug,
      image: primaryImage.url,
    };
  }

  async createCategory(input: CreateProductCategoryRequestDTO) {
    try {
      const category = await this.prisma.productCategory.create({
        data: {
          title: this.parseRequiredString(input.title, "title"),
          slug: this.parseSlug(input.slug),
          image: this.parseOptionalString(input.image),
        },
      });

      return this.mapProductCategory(category);
    } catch (error) {
      this.handlePrismaMutationError(
        error,
        "Product category slug already exists",
        "Product category not found",
      );
    }
  }

  async updateCategory(
    categoryId: string,
    input: UpdateProductCategoryRequestDTO,
  ) {
    const data: Prisma.ProductCategoryUpdateInput = {};

    if (input.title !== undefined) {
      data.title = this.parseRequiredString(input.title, "title");
    }

    if (input.slug !== undefined) {
      data.slug = this.parseSlug(input.slug);
    }

    if (input.image !== undefined) {
      data.image = this.parseOptionalString(input.image) ?? null;
    }

    try {
      const category = await this.prisma.productCategory.update({
        where: { id: categoryId },
        data,
      });

      return this.mapProductCategory(category);
    } catch (error) {
      this.handlePrismaMutationError(
        error,
        "Product category slug already exists",
        "Product category not found",
      );
    }
  }

  async deleteCategory(categoryId: string) {
    try {
      const category = await this.prisma.productCategory.delete({
        where: { id: categoryId },
      });

      return this.mapProductCategory(category);
    } catch (error) {
      this.handlePrismaMutationError(
        error,
        "Product category slug already exists",
        "Product category not found",
      );
    }
  }

  async createProduct(input: CreateProductRequestDTO) {
    const status = input.status
      ? this.mapProductStatus(input.status)
      : PrismaProductStatus.DRAFT;

    if (status === PrismaProductStatus.PUBLISHED) {
      throw new BadRequestException(
        "Published product must have at least one image",
      );
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          title: this.parseRequiredString(input.title, "title"),
          slug: this.parseSlug(input.slug),
          description: this.parseOptionalString(input.description),
          status,
          isHit: input.isHit ?? false,
          category: {
            connect: {
              id: this.parseRequiredString(input.categoryId, "categoryId"),
            },
          },
          price: this.parsePriceRub(input.priceRub) * 100,
          currency: this.parseCurrency(input.currency),
        },
        include: productInclude,
      });

      return this.mapProduct(product);
    } catch (error) {
      this.handlePrismaMutationError(
        error,
        "Product slug already exists",
        "Product category not found",
      );
    }
  }

  async updateProduct(productId: string, input: UpdateProductRequestDTO) {
    const data: Prisma.ProductUpdateInput = {};

    if (input.title !== undefined) {
      data.title = this.parseRequiredString(input.title, "title");
    }

    if (input.slug !== undefined) {
      data.slug = this.parseSlug(input.slug);
    }

    if (input.description !== undefined) {
      data.description = this.parseOptionalString(input.description) ?? null;
    }

    if (input.status !== undefined) {
      const status = this.mapProductStatus(input.status);
      data.status = status;

      if (status === PrismaProductStatus.PUBLISHED) {
        await this.ensureProductHasImages(productId);
      }
    }

    if (input.isHit !== undefined) {
      data.isHit = input.isHit;
    }

    if (input.categoryId !== undefined) {
      data.category = {
        connect: {
          id: this.parseRequiredString(input.categoryId, "categoryId"),
        },
      };
    }

    if (input.priceRub !== undefined) {
      data.price = this.parsePriceRub(input.priceRub) * 100;
    }

    if (input.currency !== undefined) {
      data.currency = this.parseCurrency(input.currency);
    }

    try {
      const product = await this.prisma.product.update({
        where: { id: productId },
        data,
        include: productInclude,
      });

      return this.mapProduct(product);
    } catch (error) {
      this.handlePrismaMutationError(error, "Product slug already exists");
    }
  }

  async deleteProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    await this.prisma.product.delete({
      where: { id: productId },
    });

    await Promise.all(
      product.images.map((image) => this.deleteLocalImageFile(image.url)),
    );

    return this.mapProduct(product);
  }

  async addProductImage(
    productId: string,
    file: UploadedProductFile | undefined,
    alt: string | undefined,
  ) {
    if (!file) {
      throw new BadRequestException("Product image file is required");
    }

    await this.ensureProduct(productId);

    const imageId = randomBytes(16).toString("hex");
    const extension = this.getImageExtension(file);
    const fileName = `${imageId}.${extension}`;
    const fileDirectory = join(this.getUploadsRoot(), "products", productId);
    const filePath = join(fileDirectory, fileName);
    const url = `${this.getApiPublicUrl()}/uploads/products/${productId}/${fileName}`;
    const imagesAggregate = await this.prisma.productImage.aggregate({
      where: { productId },
      _max: {
        sortOrder: true,
      },
    });

    await mkdir(fileDirectory, { recursive: true });
    await writeFile(filePath, file.buffer);

    try {
      const image = await this.prisma.productImage.create({
        data: {
          id: imageId,
          productId,
          url,
          alt: this.parseOptionalString(alt),
          sortOrder: (imagesAggregate._max.sortOrder ?? -1) + 1,
        },
      });

      return this.mapProductImage(image);
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  async updateProductImage(
    productId: string,
    imageId: string,
    input: UpdateProductImageRequestDTO,
  ) {
    await this.ensureProductImage(productId, imageId);

    const image = await this.prisma.productImage.update({
      where: { id: imageId },
      data: {
        ...(input.alt !== undefined
          ? { alt: this.parseOptionalString(input.alt) ?? null }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    return this.mapProductImage(image);
  }

  async deleteProductImage(productId: string, imageId: string) {
    const image = await this.ensureProductImage(productId, imageId);
    await this.ensureImageCanBeDeleted(productId);

    await this.prisma.productImage.delete({
      where: { id: imageId },
    });
    await this.deleteLocalImageFile(image.url);

    return this.mapProductImage(image);
  }

  private async ensureProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }
  }

  private async ensureProductHasImages(productId: string) {
    const imagesCount = await this.prisma.productImage.count({
      where: { productId },
    });

    if (imagesCount === 0) {
      throw new BadRequestException(
        "Published product must have at least one image",
      );
    }
  }

  private async ensureImageCanBeDeleted(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        status: true,
        _count: {
          select: {
            images: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    if (
      product.status === PrismaProductStatus.PUBLISHED &&
      product._count.images <= 1
    ) {
      throw new BadRequestException(
        "Published product must have at least one image",
      );
    }
  }

  private async ensureProductImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundException("Product image not found");
    }

    return image;
  }

  private getImageExtension(file: UploadedProductFile) {
    if (file.size <= 0) {
      throw new BadRequestException("Product image file is empty");
    }

    if (file.size > maxProductImageSizeBytes) {
      throw new BadRequestException("Product image file is too large");
    }

    if (!this.isProductImageMimeType(file.mimetype)) {
      throw new BadRequestException("Product image must be JPEG, PNG or WebP");
    }

    switch (file.mimetype) {
      case "image/jpeg":
        return "jpg";
      case "image/png":
        return "png";
      case "image/webp":
        return "webp";
    }
  }

  private isProductImageMimeType(
    value: string,
  ): value is ProductImageMimeType {
    return productImageMimeTypes.includes(value as ProductImageMimeType);
  }

  private parseRequiredString(value: string, field: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }

    return trimmed;
  }

  private parseOptionalString(value: string | undefined) {
    const trimmed = value?.trim();

    return trimmed ? trimmed : undefined;
  }

  private parseSlug(value: string) {
    const slug = this.parseRequiredString(value, "slug").toLowerCase();

    if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException(
        "slug must contain latin letters, numbers, hyphens or underscores",
      );
    }

    return slug;
  }

  private parsePriceRub(value: number) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maxPriceRub) {
      throw new BadRequestException(
        `priceRub must be an integer from 0 to ${maxPriceRub}`,
      );
    }

    return value;
  }

  private parseCurrency(value: ProductCurrency | undefined) {
    const currency = value ?? "RUB";

    if (!productCurrencies.includes(currency)) {
      throw new BadRequestException("currency is not supported");
    }

    return currency;
  }

  private mapProductStatus(status: ProductStatus) {
    switch (status) {
      case "draft":
        return PrismaProductStatus.DRAFT;
      case "published":
        return PrismaProductStatus.PUBLISHED;
      case "archived":
        return PrismaProductStatus.ARCHIVED;
    }
  }

  private mapPrismaProductStatus(status: PrismaProductStatus): ProductStatus {
    switch (status) {
      case PrismaProductStatus.DRAFT:
        return "draft";
      case PrismaProductStatus.PUBLISHED:
        return "published";
      case PrismaProductStatus.ARCHIVED:
        return "archived";
    }
  }

  private mapProduct(product: StoredProduct) {
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description ?? undefined,
      status: this.mapPrismaProductStatus(product.status),
      isHit: product.isHit,
      categoryId: product.categoryId,
      category: this.mapProductCategory(product.category),
      price: product.price,
      priceRub: Math.trunc(product.price / 100),
      currency: product.currency as ProductCurrency,
      images: product.images.map((image) => this.mapProductImage(image)),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private mapProductCategory(category: StoredProductCategory) {
    return {
      id: category.id,
      slug: category.slug,
      title: category.title,
      image: category.image ?? undefined,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private mapProductImage(image: {
    id: string;
    url: string;
    alt: string | null;
    sortOrder: number;
    createdAt: Date;
  }) {
    return {
      id: image.id,
      url: image.url,
      alt: image.alt ?? undefined,
      sortOrder: image.sortOrder,
      createdAt: image.createdAt.toISOString(),
    };
  }

  private getUploadsRoot() {
    return join(process.cwd(), "uploads");
  }

  private getApiPublicUrl() {
    const baseUrl =
      process.env.API_PUBLIC_URL ??
      process.env.API_BASE_URL ??
      `http://localhost:${process.env.PORT ?? "3002"}`;

    return baseUrl.replace(/\/+$/, "");
  }

  private async deleteLocalImageFile(url: string) {
    const filePath = this.getLocalImageFilePath(url);

    if (!filePath) {
      return;
    }

    await unlink(filePath).catch(() => undefined);
  }

  private getLocalImageFilePath(url: string) {
    let pathname: string;

    try {
      pathname = new URL(url).pathname;
    } catch {
      return undefined;
    }

    if (!pathname.startsWith("/uploads/products/")) {
      return undefined;
    }

    const relativePath = decodeURIComponent(pathname.replace(/^\/uploads\//, ""));

    if (relativePath.split("/").includes("..")) {
      return undefined;
    }

    return join(this.getUploadsRoot(), relativePath);
  }

  private handlePrismaMutationError(
    error: unknown,
    duplicateMessage = "Product slug already exists",
    notFoundMessage = "Product not found",
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new BadRequestException(duplicateMessage);
      }

      if (error.code === "P2003") {
        throw new BadRequestException(
          "Product category is used by existing products",
        );
      }

      if (error.code === "P2025") {
        throw new NotFoundException(notFoundMessage);
      }
    }

    throw error;
  }
}
