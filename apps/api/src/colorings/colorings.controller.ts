import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiConsumes,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { FileFieldsInterceptor } from "@nestjs/platform-express";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import { ColoringsService } from "./colorings.service";
import { AdminColoringsGuard } from "./admin-colorings.guard";
import { coloringPaletteDescription } from "./coloring-palette";
import {
  ColoringRevisionsService,
  type UploadedColoringRevisionFiles,
} from "./coloring-revisions.service";
import {
  ColoringDTO,
  ColoringRevisionDTO,
  CreateColoringRequestDTO,
  CreateColoringRevisionRequestDTO,
  ReviewColoringRevisionRequestDTO,
  UpdateColoringRequestDTO,
} from "./dto";

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Colorings")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Authentication required" })
@ApiForbiddenResponse({
  description:
    "Admin role required; unsafe requests also require a valid CSRF token",
})
@ApiExtraModels(CreateColoringRevisionRequestDTO)
@UseGuards(AuthGuard, AdminColoringsGuard)
@Controller("admin/colorings")
export class AdminColoringsController {
  constructor(
    private readonly coloringsService: ColoringsService,
    private readonly usersService: UsersService,
    private readonly coloringRevisionsService: ColoringRevisionsService,
  ) {}

  @ValidateResponse(ColoringDTO, { isArray: true })
  @ApiOperation({ summary: "List colorings for admin panel" })
  @ApiOkResponse({ type: [ColoringDTO] })
  @Get()
  getColorings(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.coloringsService.getColorings();
  }

  @ValidateResponse(ColoringDTO)
  @ApiOperation({ summary: "Get coloring for admin panel" })
  @ApiOkResponse({ type: ColoringDTO })
  @Get(":id")
  getColoring(
    @Param("id") coloringId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.coloringsService.getColoring(coloringId);
  }

  @ValidateResponse(ColoringDTO)
  @ApiOperation({ summary: "Create draft coloring from admin panel" })
  @ApiCreatedResponse({ type: ColoringDTO })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { default: "1", enum: ["1"] },
  })
  @Post()
  createColoring(
    @Body() body: CreateColoringRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.coloringsService.createColoring(body);
  }

  @ValidateResponse(ColoringDTO)
  @ApiOperation({ summary: "Update draft coloring metadata from admin panel" })
  @ApiOkResponse({ type: ColoringDTO })
  @ApiConflictResponse({
    description: "Coloring is immutable or changed concurrently",
  })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { default: "1", enum: ["1"] },
  })
  @Patch(":id")
  updateColoring(
    @Param("id") coloringId: string,
    @Body() body: UpdateColoringRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.coloringsService.updateColoring(coloringId, body);
  }

  @ValidateResponse(ColoringRevisionDTO)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: [
        "outline",
        "colored",
        "markerColorIds",
        "outlineAlt",
        "coloredAlt",
      ],
      properties: {
        outline: { type: "string", format: "binary" },
        colored: { type: "string", format: "binary" },
        markerColorIds: {
          type: "string",
          description: coloringPaletteDescription,
          example: '["marker-color-104","marker-color-001"]',
        },
        outlineAlt: { type: "string", minLength: 1, maxLength: 220 },
        coloredAlt: { type: "string", minLength: 1, maxLength: 220 },
      },
    },
  })
  @ApiOperation({ summary: "Create a safe coloring media revision" })
  @ApiCreatedResponse({ type: ColoringRevisionDTO })
  @ApiBadRequestResponse({
    description: "Invalid multipart, metadata or image pair",
  })
  @ApiPayloadTooLargeResponse({
    description: "A file exceeds the 20 MiB limit",
  })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { default: "1", enum: ["1"] },
  })
  @Post(":coloringId/revisions")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "outline", maxCount: 1 },
        { name: "colored", maxCount: 1 },
      ],
      {
        limits: {
          fieldSize: 16 * 1024,
          fields: 3,
          fileSize: 20 * 1024 * 1024,
          files: 2,
          // Busboy emits partsLimit when the counter reaches the limit, so the
          // valid two-file plus three-field payload needs an exclusive bound.
          parts: 6,
        },
      },
    ),
  )
  createRevision(
    @Param("coloringId") coloringId: string,
    @UploadedFiles() files: UploadedColoringRevisionFiles | undefined,
    @Body() body: CreateColoringRevisionRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.coloringRevisionsService.createRevision(
      coloringId,
      body,
      files,
      request.user.id,
    );
  }

  @ValidateResponse(ColoringRevisionDTO, { isArray: true })
  @ApiOperation({ summary: "List coloring media revisions" })
  @ApiOkResponse({ type: [ColoringRevisionDTO] })
  @ApiNotFoundResponse({ description: "Coloring not found" })
  @Get(":coloringId/revisions")
  getRevisions(
    @Param("coloringId") coloringId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.coloringRevisionsService.getRevisions(coloringId);
  }

  @Header("Cache-Control", "private, no-store")
  @Header("Content-Type", "image/webp")
  @ApiOperation({ summary: "Read a protected coloring revision derivative" })
  @ApiParam({ name: "kind", enum: ["outline", "colored"] })
  @ApiOkResponse({
    description: "Protected immutable WebP derivative",
    content: {
      "image/webp": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  @ApiBadRequestResponse({ description: "Coloring asset kind is invalid" })
  @ApiNotFoundResponse({ description: "Coloring revision asset not found" })
  @Get(":coloringId/revisions/:revisionId/assets/:kind/content")
  async getRevisionAsset(
    @Param("coloringId") coloringId: string,
    @Param("revisionId") revisionId: string,
    @Param("kind") kind: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    if (kind !== "outline" && kind !== "colored") {
      throw new BadRequestException("Coloring asset kind is invalid");
    }

    const buffer = await this.coloringRevisionsService.getRevisionAsset(
      coloringId,
      revisionId,
      kind,
    );

    return new StreamableFile(buffer, { type: "image/webp" });
  }

  @ValidateResponse(ColoringRevisionDTO)
  @ApiOperation({ summary: "Review a coloring media revision once" })
  @ApiCreatedResponse({ type: ColoringRevisionDTO })
  @ApiBadRequestResponse({ description: "Review payload is invalid" })
  @ApiNotFoundResponse({ description: "Coloring revision not found" })
  @ApiConflictResponse({
    description: "Coloring revision was already reviewed",
  })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { default: "1", enum: ["1"] },
  })
  @Post(":coloringId/revisions/:revisionId/review")
  reviewRevision(
    @Param("coloringId") coloringId: string,
    @Param("revisionId") revisionId: string,
    @Body() body: ReviewColoringRevisionRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.coloringRevisionsService.reviewRevision(
      coloringId,
      revisionId,
      body,
      request.user.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @ValidateResponse(ColoringRevisionDTO)
  @ApiOperation({ summary: "Publish an approved coloring media revision" })
  @ApiOkResponse({ type: ColoringRevisionDTO })
  @ApiBadRequestResponse({
    description: "Coloring revision is not ready for publication",
  })
  @ApiNotFoundResponse({ description: "Coloring revision not found" })
  @ApiConflictResponse({
    description: "Coloring publication state changed concurrently",
  })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { default: "1", enum: ["1"] },
  })
  @Post(":coloringId/revisions/:revisionId/publish")
  publishRevision(
    @Param("coloringId") coloringId: string,
    @Param("revisionId") revisionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.coloringRevisionsService.publishRevision(
      coloringId,
      revisionId,
      request.user.id,
    );
  }
}
