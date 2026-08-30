import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import { AdminColoringsGuard } from "./admin-colorings.guard";
import {
  ColoringCollectionCoverService,
  type UploadedColoringCollectionCover,
} from "./coloring-collection-cover.service";
import { ColoringCollectionsService } from "./coloring-collections.service";
import {
  ColoringCollectionDTO,
  CreateColoringCollectionRequestDTO,
  UploadColoringCollectionCoverRequestDTO,
  UpdateColoringCollectionRequestDTO,
} from "./dto";

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Coloring collections")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Authentication required" })
@ApiForbiddenResponse({
  description:
    "Admin role required; unsafe requests also require a valid CSRF token",
})
@UseGuards(AuthGuard, AdminColoringsGuard)
@Controller("admin/coloring-collections")
export class AdminColoringCollectionsController {
  constructor(
    private readonly collectionsService: ColoringCollectionsService,
    private readonly usersService: UsersService,
    private readonly coverService: ColoringCollectionCoverService,
  ) {}

  @ValidateResponse(ColoringCollectionDTO, { isArray: true })
  @ApiOperation({ summary: "List coloring collections for admin panel" })
  @ApiOkResponse({ type: [ColoringCollectionDTO] })
  @Get()
  getCollections(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.collectionsService.getCollections();
  }

  @ValidateResponse(ColoringCollectionDTO)
  @ApiOperation({ summary: "Get a coloring collection for admin panel" })
  @ApiOkResponse({ type: ColoringCollectionDTO })
  @ApiNotFoundResponse({ description: "Coloring collection not found" })
  @Get(":id")
  getCollection(
    @Param("id") collectionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.collectionsService.getCollection(collectionId);
  }

  @ValidateResponse(ColoringCollectionDTO)
  @ApiOperation({ summary: "Create a draft coloring collection" })
  @ApiCreatedResponse({ type: ColoringCollectionDTO })
  @ApiConflictResponse({
    description: "Product already has a collection or slug is already used",
  })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { default: "1", enum: ["1"] },
  })
  @Post()
  createCollection(
    @Body() body: CreateColoringCollectionRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.collectionsService.createCollection(body);
  }

  @ValidateResponse(ColoringCollectionDTO)
  @ApiOperation({ summary: "Update draft coloring collection metadata" })
  @ApiOkResponse({ type: ColoringCollectionDTO })
  @ApiConflictResponse({
    description: "Collection is immutable or changed concurrently",
  })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { default: "1", enum: ["1"] },
  })
  @Patch(":id")
  updateCollection(
    @Param("id") collectionId: string,
    @Body() body: UpdateColoringCollectionRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.collectionsService.updateCollection(collectionId, body);
  }

  @HttpCode(HttpStatus.OK)
  @ValidateResponse(ColoringCollectionDTO)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["cover", "alt", "updatedAt"],
      properties: {
        cover: { type: "string", format: "binary" },
        alt: { type: "string", minLength: 1, maxLength: 220 },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiOperation({ summary: "Upload a coloring collection cover" })
  @ApiOkResponse({ type: ColoringCollectionDTO })
  @ApiBadRequestResponse({ description: "Invalid cover image or alt text" })
  @ApiConflictResponse({
    description: "Collection is immutable or changed concurrently",
  })
  @ApiPayloadTooLargeResponse({ description: "Cover exceeds 10 MiB" })
  @ApiNotFoundResponse({ description: "Coloring collection not found" })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { default: "1", enum: ["1"] },
  })
  @Post(":id/cover")
  @UseInterceptors(
    FileInterceptor("cover", {
      limits: {
        fieldSize: 1_024,
        fields: 2,
        fileSize: 10 * 1024 * 1024,
        files: 1,
        // Busboy's parts limit is exclusive: one file plus two fields needs 4.
        parts: 4,
      },
    }),
  )
  async uploadCover(
    @Param("id") collectionId: string,
    @UploadedFile() file: UploadedColoringCollectionCover | undefined,
    @Body() body: UploadColoringCollectionCoverRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    await this.coverService.uploadCover(
      collectionId,
      file,
      body.alt,
      body.updatedAt,
    );

    return this.collectionsService.getCollection(collectionId);
  }

  @HttpCode(HttpStatus.OK)
  @ValidateResponse(ColoringCollectionDTO)
  @ApiOperation({ summary: "Publish a ready coloring collection" })
  @ApiOkResponse({ type: ColoringCollectionDTO })
  @ApiConflictResponse({
    description: "Collection, product, cover or coloring is not publish-ready",
  })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { default: "1", enum: ["1"] },
  })
  @Post(":id/publish")
  publishCollection(
    @Param("id") collectionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.collectionsService.publishCollection(collectionId);
  }
}
