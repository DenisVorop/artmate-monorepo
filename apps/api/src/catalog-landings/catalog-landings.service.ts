import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import sanitizeHtml from "sanitize-html";

import {
  CatalogLandingProductOverrideMode as PrismaCatalogLandingProductOverrideMode,
  CatalogLandingProductSource as PrismaCatalogLandingProductSource,
  CatalogLandingStatus as PrismaCatalogLandingStatus,
  CatalogLandingTagRuleMode as PrismaCatalogLandingTagRuleMode,
  Prisma,
  ProductStatus as PrismaProductStatus,
  ProductTagGroup as PrismaProductTagGroup,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { productTagGroups, type ProductTagGroup } from "../products/products.types";

import type {
  CatalogLandingProductOverrideInputDTO,
  CatalogLandingTagRuleInputDTO,
  CreateCatalogLandingPageRequestDTO,
  UpdateCatalogLandingPageRequestDTO,
} from "./dto";
import {
  type CatalogLandingProductOverrideMode,
  type CatalogLandingProductSource,
  type CatalogLandingStatus,
  type CatalogLandingTagRuleMode,
} from "./catalog-landings.types";

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
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ProductInclude;

const landingInclude = {
  faqItems: {
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  },
  productOverrides: {
    include: {
      product: {
        include: productInclude,
      },
    },
    orderBy: [
      {
        sortOrder: "asc",
      },
    ],
  },
  tagRules: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.CatalogLandingPageInclude;

const maxLandingRichTextLength = 20_000;
const landingRichTextSanitizeOptions: sanitizeHtml.IOptions = {
  allowedAttributes: {
    a: ["href", "rel", "title"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "h2", "h3", "a"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  nestingLimit: 8,
  parseStyleAttributes: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
    }),
  },
};

type StoredLanding = Prisma.CatalogLandingPageGetPayload<{
  include: typeof landingInclude;
}>;

type StoredProduct = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

type StoredProductTag = StoredProduct["tags"][number]["tag"];

type LandingRelationInput = Pick<
  CreateCatalogLandingPageRequestDTO,
  "faqItems" | "productOverrides" | "tagRules"
>;

@Injectable()
export class CatalogLandingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminLandingPages() {
    const landings = await this.prisma.catalogLandingPage.findMany({
      include: landingInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });

    return Promise.all(landings.map((landing) => this.mapLanding(landing, false)));
  }

  async getAdminLandingPage(landingId: string) {
    const landing = await this.getLandingOrThrow(landingId);

    return this.mapLanding(landing, false);
  }

  async getPublishedLandingPages() {
    const landings = await this.prisma.catalogLandingPage.findMany({
      where: {
        isIndexable: true,
        status: PrismaCatalogLandingStatus.PUBLISHED,
      },
      include: landingInclude,
      orderBy: {
        updatedAt: "desc",
      },
    });
    const mappedLandings = await Promise.all(
      landings.map((landing) => this.mapLanding(landing, true)),
    );

    return mappedLandings.filter((landing) => landing.products.length >= landing.minProducts);
  }

  async getPublishedLandingPage(slug: string) {
    const landing = await this.prisma.catalogLandingPage.findUnique({
      where: {
        slug: this.parseSlug(slug),
      },
      include: landingInclude,
    });

    if (!landing || landing.status !== PrismaCatalogLandingStatus.PUBLISHED) {
      throw new NotFoundException("Catalog landing page not found");
    }

    const mappedLanding = await this.mapLanding(landing, true);

    if (mappedLanding.products.length < mappedLanding.minProducts) {
      throw new NotFoundException("Catalog landing page not found");
    }

    return mappedLanding;
  }

  async createLandingPage(input: CreateCatalogLandingPageRequestDTO) {
    const requestedStatus = this.mapCatalogLandingStatus(input.status ?? "draft");

    try {
      const createdLanding = await this.prisma.$transaction(async (tx) => {
        const landing = await tx.catalogLandingPage.create({
          data: {
            slug: this.parseSlug(input.slug),
            status: PrismaCatalogLandingStatus.DRAFT,
            isIndexable: input.isIndexable ?? true,
            h1: this.parseRequiredString(input.h1, "h1"),
            metaTitle: this.parseRequiredString(input.metaTitle, "metaTitle"),
            metaDescription: this.parseRequiredString(input.metaDescription, "metaDescription"),
            introHtml: this.parseOptionalRichHtml(input.introHtml),
            seoTitle: this.parseOptionalString(input.seoTitle) ?? null,
            seoHtml: this.parseOptionalRichHtml(input.seoHtml),
            productSource: this.mapCatalogLandingProductSource(input.productSource ?? "tags"),
            minProducts: this.parseMinProducts(input.minProducts ?? 2),
          },
        });

        await this.syncLandingRelations(tx, landing.id, input);

        return this.getLandingById(tx, landing.id);
      });

      if (requestedStatus === PrismaCatalogLandingStatus.PUBLISHED) {
        return this.publishLandingPage(createdLanding.id);
      }

      if (requestedStatus === PrismaCatalogLandingStatus.ARCHIVED) {
        const archivedLanding = await this.prisma.catalogLandingPage.update({
          where: { id: createdLanding.id },
          data: {
            status: PrismaCatalogLandingStatus.ARCHIVED,
          },
          include: landingInclude,
        });

        return this.mapLanding(archivedLanding, false);
      }

      return this.mapLanding(createdLanding, false);
    } catch (error) {
      this.handlePrismaMutationError(error);
    }
  }

  async updateLandingPage(landingId: string, input: UpdateCatalogLandingPageRequestDTO) {
    const requestedStatus =
      input.status !== undefined ? this.mapCatalogLandingStatus(input.status) : undefined;

    try {
      const updatedLanding = await this.prisma.$transaction(async (tx) => {
        await this.ensureLanding(tx, landingId);

        const data: Prisma.CatalogLandingPageUpdateInput = {};

        if (input.slug !== undefined) {
          data.slug = this.parseSlug(input.slug);
        }

        if (input.isIndexable !== undefined) {
          data.isIndexable = input.isIndexable;
        }

        if (input.h1 !== undefined) {
          data.h1 = this.parseRequiredString(input.h1, "h1");
        }

        if (input.metaTitle !== undefined) {
          data.metaTitle = this.parseRequiredString(input.metaTitle, "metaTitle");
        }

        if (input.metaDescription !== undefined) {
          data.metaDescription = this.parseRequiredString(
            input.metaDescription,
            "metaDescription",
          );
        }

        if (input.introHtml !== undefined) {
          data.introHtml = this.parseOptionalRichHtml(input.introHtml);
        }

        if (input.seoTitle !== undefined) {
          data.seoTitle = this.parseOptionalString(input.seoTitle) ?? null;
        }

        if (input.seoHtml !== undefined) {
          data.seoHtml = this.parseOptionalRichHtml(input.seoHtml);
        }

        if (input.productSource !== undefined) {
          data.productSource = this.mapCatalogLandingProductSource(input.productSource);
        }

        if (input.minProducts !== undefined) {
          data.minProducts = this.parseMinProducts(input.minProducts);
        }

        if (requestedStatus && requestedStatus !== PrismaCatalogLandingStatus.PUBLISHED) {
          data.status = requestedStatus;
        }

        if (requestedStatus === PrismaCatalogLandingStatus.PUBLISHED) {
          data.status = PrismaCatalogLandingStatus.DRAFT;
        }

        await tx.catalogLandingPage.update({
          where: { id: landingId },
          data,
        });
        await this.syncLandingRelations(tx, landingId, input);

        return this.getLandingById(tx, landingId);
      });

      if (requestedStatus === PrismaCatalogLandingStatus.PUBLISHED) {
        return this.publishLandingPage(updatedLanding.id);
      }

      return this.mapLanding(updatedLanding, false);
    } catch (error) {
      this.handlePrismaMutationError(error);
    }
  }

  async publishLandingPage(landingId: string) {
    const landing = await this.getLandingOrThrow(landingId);

    await this.assertLandingCanBePublished(landing);

    const publishedLanding = await this.prisma.catalogLandingPage.update({
      where: { id: landingId },
      data: {
        status: PrismaCatalogLandingStatus.PUBLISHED,
      },
      include: landingInclude,
    });

    return this.mapLanding(publishedLanding, false);
  }

  async deleteLandingPage(landingId: string) {
    const landing = await this.getLandingOrThrow(landingId);

    await this.prisma.catalogLandingPage.delete({
      where: { id: landingId },
    });

    return this.mapLanding(landing, false);
  }

  private async getLandingOrThrow(landingId: string) {
    const landing = await this.prisma.catalogLandingPage.findUnique({
      where: {
        id: landingId,
      },
      include: landingInclude,
    });

    if (!landing) {
      throw new NotFoundException("Catalog landing page not found");
    }

    return landing;
  }

  private async getLandingById(tx: Prisma.TransactionClient, landingId: string) {
    const landing = await tx.catalogLandingPage.findUnique({
      where: {
        id: landingId,
      },
      include: landingInclude,
    });

    if (!landing) {
      throw new NotFoundException("Catalog landing page not found");
    }

    return landing;
  }

  private async ensureLanding(tx: Prisma.TransactionClient, landingId: string) {
    const landing = await tx.catalogLandingPage.findUnique({
      where: {
        id: landingId,
      },
      select: {
        id: true,
      },
    });

    if (!landing) {
      throw new NotFoundException("Catalog landing page not found");
    }
  }

  private async syncLandingRelations(
    tx: Prisma.TransactionClient,
    landingId: string,
    input: LandingRelationInput,
  ) {
    if (input.tagRules !== undefined) {
      await tx.catalogLandingTagRule.deleteMany({
        where: {
          landingId,
        },
      });

      const tagRules = this.normalizeTagRules(input.tagRules);

      if (tagRules.length > 0) {
        await tx.catalogLandingTagRule.createMany({
          data: tagRules.map((rule) => ({
            landingId,
            tagId: rule.tagId,
            mode: this.mapCatalogLandingTagRuleMode(rule.mode),
          })),
        });
      }
    }

    if (input.productOverrides !== undefined) {
      await tx.catalogLandingProductOverride.deleteMany({
        where: {
          landingId,
        },
      });

      const productOverrides = this.normalizeProductOverrides(input.productOverrides);

      if (productOverrides.length > 0) {
        await tx.catalogLandingProductOverride.createMany({
          data: productOverrides.map((override) => ({
            landingId,
            productId: override.productId,
            mode: this.mapCatalogLandingProductOverrideMode(override.mode),
            sortOrder: override.sortOrder,
          })),
        });
      }
    }

    if (input.faqItems !== undefined) {
      await tx.catalogLandingFaqItem.deleteMany({
        where: {
          landingId,
        },
      });

      const faqItems = input.faqItems
        .map((item) => ({
          question: this.parseRequiredString(item.question, "faq question"),
          answerHtml: this.parseRequiredRichHtml(item.answerHtml, "faq answer"),
          sortOrder: this.parseSortOrder(item.sortOrder),
        }))
        .filter((item) => item.question && item.answerHtml);

      if (faqItems.length > 0) {
        await tx.catalogLandingFaqItem.createMany({
          data: faqItems.map((item) => ({
            landingId,
            ...item,
          })),
        });
      }
    }
  }

  private async assertLandingCanBePublished(landing: StoredLanding) {
    if (!this.hasVisibleText(landing.introHtml) && !this.hasVisibleText(landing.seoHtml)) {
      throw new BadRequestException("Catalog landing page must have intro or SEO text");
    }

    const products = await this.resolveLandingProducts(landing, true);

    if (products.length < landing.minProducts) {
      throw new BadRequestException(
        `Catalog landing page must have at least ${landing.minProducts} published products`,
      );
    }
  }

  private async mapLanding(landing: StoredLanding, publishedOnly: boolean) {
    const products = await this.resolveLandingProducts(landing, publishedOnly);

    return {
      id: landing.id,
      slug: landing.slug,
      status: this.mapPrismaCatalogLandingStatus(landing.status),
      isIndexable: landing.isIndexable,
      h1: landing.h1,
      metaTitle: landing.metaTitle,
      metaDescription: landing.metaDescription,
      introHtml: landing.introHtml ?? undefined,
      seoTitle: landing.seoTitle ?? undefined,
      seoHtml: landing.seoHtml ?? undefined,
      productSource: this.mapPrismaCatalogLandingProductSource(landing.productSource),
      minProducts: landing.minProducts,
      tagRules: landing.tagRules.map((rule) => ({
        tagId: rule.tagId,
        mode: this.mapPrismaCatalogLandingTagRuleMode(rule.mode),
        tag: this.mapProductTag(rule.tag),
      })),
      productOverrides: landing.productOverrides.map((override) => ({
        productId: override.productId,
        mode: this.mapPrismaCatalogLandingProductOverrideMode(override.mode),
        sortOrder: override.sortOrder,
        product: this.mapProduct(override.product),
      })),
      faqItems: landing.faqItems.map((item) => ({
        id: item.id,
        question: item.question,
        answerHtml: item.answerHtml,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      products: products.map((product) => this.mapProduct(product)),
      createdAt: landing.createdAt.toISOString(),
      updatedAt: landing.updatedAt.toISOString(),
    };
  }

  private async resolveLandingProducts(landing: StoredLanding, publishedOnly: boolean) {
    const products = await this.prisma.product.findMany({
      where: {
        ...(publishedOnly
          ? {
              images: {
                some: {},
              },
              status: PrismaProductStatus.PUBLISHED,
            }
          : {}),
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
    const includedOverrides = landing.productOverrides.filter(
      (override) => override.mode === PrismaCatalogLandingProductOverrideMode.INCLUDED,
    );
    const excludedProductIds = new Set(
      landing.productOverrides
        .filter((override) => override.mode === PrismaCatalogLandingProductOverrideMode.EXCLUDED)
        .map((override) => override.productId),
    );
    const includedProductIds = new Set(includedOverrides.map((override) => override.productId));
    const includedSortOrder = new Map(
      includedOverrides.map((override) => [override.productId, override.sortOrder]),
    );
    const productsById = new Map(products.map((product) => [product.id, product]));
    const tagProducts =
      landing.productSource === PrismaCatalogLandingProductSource.MANUAL
        ? []
        : this.filterProductsByTagRules(products, landing.tagRules);
    const manualProducts = includedOverrides.flatMap((override) => {
      const product = productsById.get(override.productId);

      return product ? [product] : [];
    });
    const productCandidates =
      landing.productSource === PrismaCatalogLandingProductSource.MANUAL
        ? manualProducts
        : landing.productSource === PrismaCatalogLandingProductSource.MIXED
          ? [...tagProducts, ...manualProducts]
          : tagProducts;
    const uniqueProducts = new Map<string, StoredProduct>();

    for (const product of productCandidates) {
      if (!excludedProductIds.has(product.id)) {
        uniqueProducts.set(product.id, product);
      }
    }

    return [...uniqueProducts.values()].sort((a, b) => {
      const aSortOrder = includedSortOrder.get(a.id);
      const bSortOrder = includedSortOrder.get(b.id);

      if (aSortOrder !== undefined && bSortOrder !== undefined) {
        return aSortOrder - bSortOrder;
      }

      if (aSortOrder !== undefined) {
        return -1;
      }

      if (bSortOrder !== undefined) {
        return 1;
      }

      if (includedProductIds.has(a.id) && !includedProductIds.has(b.id)) {
        return -1;
      }

      if (!includedProductIds.has(a.id) && includedProductIds.has(b.id)) {
        return 1;
      }

      if (a.isHit !== b.isHit) {
        return a.isHit ? -1 : 1;
      }

      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  private filterProductsByTagRules(
    products: readonly StoredProduct[],
    tagRules: StoredLanding["tagRules"],
  ) {
    const requiredTagIds = tagRules
      .filter((rule) => rule.mode === PrismaCatalogLandingTagRuleMode.REQUIRED)
      .map((rule) => rule.tagId);
    const optionalTagIds = tagRules
      .filter((rule) => rule.mode === PrismaCatalogLandingTagRuleMode.OPTIONAL)
      .map((rule) => rule.tagId);
    const excludedTagIds = new Set(
      tagRules
        .filter((rule) => rule.mode === PrismaCatalogLandingTagRuleMode.EXCLUDED)
        .map((rule) => rule.tagId),
    );

    if (requiredTagIds.length === 0 && optionalTagIds.length === 0) {
      return [];
    }

    return products.filter((product) => {
      const productTagIds = new Set(product.tags.map((assignment) => assignment.tagId));

      if ([...excludedTagIds].some((tagId) => productTagIds.has(tagId))) {
        return false;
      }

      if (requiredTagIds.length > 0) {
        return requiredTagIds.every((tagId) => productTagIds.has(tagId));
      }

      return optionalTagIds.some((tagId) => productTagIds.has(tagId));
    });
  }

  private normalizeTagRules(tagRules: readonly CatalogLandingTagRuleInputDTO[]) {
    const rulesByTagId = new Map<string, CatalogLandingTagRuleInputDTO>();

    for (const rule of tagRules) {
      const tagId = this.parseOptionalString(rule.tagId);

      if (tagId) {
        rulesByTagId.set(tagId, {
          tagId,
          mode: rule.mode,
        });
      }
    }

    return [...rulesByTagId.values()];
  }

  private normalizeProductOverrides(
    productOverrides: readonly CatalogLandingProductOverrideInputDTO[],
  ) {
    const overridesByProductId = new Map<string, CatalogLandingProductOverrideInputDTO>();

    for (const override of productOverrides) {
      const productId = this.parseOptionalString(override.productId);

      if (productId) {
        overridesByProductId.set(productId, {
          productId,
          mode: override.mode,
          sortOrder: this.parseSortOrder(override.sortOrder),
        });
      }
    }

    return [...overridesByProductId.values()];
  }

  private parseRequiredString(value: string, field: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }

    return trimmed;
  }

  private parseOptionalString(value: string | undefined | null) {
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

  private parseMinProducts(value: number) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
      throw new BadRequestException("minProducts must be an integer from 0 to 100");
    }

    return value;
  }

  private parseSortOrder(value: number) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
      throw new BadRequestException("sortOrder must be an integer from 0 to 10000");
    }

    return value;
  }

  private parseOptionalRichHtml(value: string | undefined | null) {
    const trimmed = value?.trim();

    if (!trimmed) {
      return null;
    }

    if (trimmed.length > maxLandingRichTextLength) {
      throw new BadRequestException(
        `rich text must be at most ${maxLandingRichTextLength} characters`,
      );
    }

    return this.sanitizeRichHtml(trimmed);
  }

  private parseRequiredRichHtml(value: string, field: string) {
    const sanitized = this.parseOptionalRichHtml(value);

    if (!sanitized) {
      throw new BadRequestException(`${field} must be a non-empty rich text`);
    }

    return sanitized;
  }

  private sanitizeRichHtml(value: string) {
    const sanitized = sanitizeHtml(value, landingRichTextSanitizeOptions).trim();

    return this.hasVisibleText(sanitized) ? sanitized : null;
  }

  private hasVisibleText(value: string | null | undefined) {
    const textContent = sanitizeHtml(value ?? "", {
      allowedAttributes: {},
      allowedTags: [],
    })
      .replace(/\u00a0/g, " ")
      .trim();

    return Boolean(textContent);
  }

  private mapCatalogLandingStatus(status: CatalogLandingStatus) {
    switch (status) {
      case "draft":
        return PrismaCatalogLandingStatus.DRAFT;
      case "published":
        return PrismaCatalogLandingStatus.PUBLISHED;
      case "archived":
        return PrismaCatalogLandingStatus.ARCHIVED;
    }
  }

  private mapPrismaCatalogLandingStatus(status: PrismaCatalogLandingStatus): CatalogLandingStatus {
    switch (status) {
      case PrismaCatalogLandingStatus.DRAFT:
        return "draft";
      case PrismaCatalogLandingStatus.PUBLISHED:
        return "published";
      case PrismaCatalogLandingStatus.ARCHIVED:
        return "archived";
    }
  }

  private mapCatalogLandingProductSource(source: CatalogLandingProductSource) {
    switch (source) {
      case "manual":
        return PrismaCatalogLandingProductSource.MANUAL;
      case "tags":
        return PrismaCatalogLandingProductSource.TAGS;
      case "mixed":
        return PrismaCatalogLandingProductSource.MIXED;
    }
  }

  private mapPrismaCatalogLandingProductSource(
    source: PrismaCatalogLandingProductSource,
  ): CatalogLandingProductSource {
    switch (source) {
      case PrismaCatalogLandingProductSource.MANUAL:
        return "manual";
      case PrismaCatalogLandingProductSource.TAGS:
        return "tags";
      case PrismaCatalogLandingProductSource.MIXED:
        return "mixed";
    }
  }

  private mapCatalogLandingTagRuleMode(mode: CatalogLandingTagRuleMode) {
    switch (mode) {
      case "required":
        return PrismaCatalogLandingTagRuleMode.REQUIRED;
      case "optional":
        return PrismaCatalogLandingTagRuleMode.OPTIONAL;
      case "excluded":
        return PrismaCatalogLandingTagRuleMode.EXCLUDED;
    }
  }

  private mapPrismaCatalogLandingTagRuleMode(
    mode: PrismaCatalogLandingTagRuleMode,
  ): CatalogLandingTagRuleMode {
    switch (mode) {
      case PrismaCatalogLandingTagRuleMode.REQUIRED:
        return "required";
      case PrismaCatalogLandingTagRuleMode.OPTIONAL:
        return "optional";
      case PrismaCatalogLandingTagRuleMode.EXCLUDED:
        return "excluded";
    }
  }

  private mapCatalogLandingProductOverrideMode(mode: CatalogLandingProductOverrideMode) {
    switch (mode) {
      case "included":
        return PrismaCatalogLandingProductOverrideMode.INCLUDED;
      case "excluded":
        return PrismaCatalogLandingProductOverrideMode.EXCLUDED;
    }
  }

  private mapPrismaCatalogLandingProductOverrideMode(
    mode: PrismaCatalogLandingProductOverrideMode,
  ): CatalogLandingProductOverrideMode {
    switch (mode) {
      case PrismaCatalogLandingProductOverrideMode.INCLUDED:
        return "included";
      case PrismaCatalogLandingProductOverrideMode.EXCLUDED:
        return "excluded";
    }
  }

  private mapProductStatus(status: PrismaProductStatus) {
    switch (status) {
      case PrismaProductStatus.DRAFT:
        return "draft";
      case PrismaProductStatus.PUBLISHED:
        return "published";
      case PrismaProductStatus.ARCHIVED:
        return "archived";
    }
  }

  private mapPrismaProductTagGroup(group: PrismaProductTagGroup): ProductTagGroup {
    switch (group) {
      case PrismaProductTagGroup.FORMAT:
        return "format";
      case PrismaProductTagGroup.THEME:
        return "theme";
      case PrismaProductTagGroup.AUDIENCE:
        return "audience";
      case PrismaProductTagGroup.MOOD:
        return "mood";
      case PrismaProductTagGroup.DIFFICULTY:
        return "difficulty";
    }
  }

  private mapProduct(product: StoredProduct) {
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description ?? undefined,
      status: this.mapProductStatus(product.status),
      isHit: product.isHit,
      isOutOfStock: product.isOutOfStock,
      isOzonDeliveryAvailable: product.isOzonDeliveryAvailable,
      categoryId: product.categoryId ?? undefined,
      category: product.category
        ? {
            id: product.category.id,
            slug: product.category.slug,
            title: product.category.title,
            image: product.category.image ?? undefined,
            createdAt: product.category.createdAt.toISOString(),
            updatedAt: product.category.updatedAt.toISOString(),
          }
        : undefined,
      price: product.price,
      priceRub: Math.trunc(product.price / 100),
      currency: product.currency as "RUB",
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt ?? undefined,
        sortOrder: image.sortOrder,
        createdAt: image.createdAt.toISOString(),
      })),
      tags: product.tags
        .map((assignment) => this.mapProductTag(assignment.tag))
        .sort((a, b) => {
          const groupCompare = productTagGroups.indexOf(a.group) - productTagGroups.indexOf(b.group);

          return groupCompare || a.title.localeCompare(b.title, "ru-RU");
        }),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private mapProductTag(tag: StoredProductTag) {
    return {
      id: tag.id,
      slug: tag.slug,
      title: tag.title,
      group: this.mapPrismaProductTagGroup(tag.group),
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString(),
    };
  }

  private handlePrismaMutationError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new BadRequestException("Catalog landing slug already exists");
      }

      if (error.code === "P2003" || error.code === "P2025") {
        throw new ConflictException("Catalog landing references missing products or tags");
      }
    }

    throw error;
  }
}
