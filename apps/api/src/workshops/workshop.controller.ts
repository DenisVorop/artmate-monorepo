import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { parseColoringNumberSegment } from "../colorings/coloring-number";
import { MarkerColorDTO } from "../colorings/dto";
import { ValidateResponse } from "../common/response-validation.interceptor";
import {
  AddWorkshopCollectionDTO,
  CreateWorkshopReportDTO,
  CreateWorkshopRevisionMultipartDTO,
  CreateWorkshopToolDTO,
  PublicWorkshopDTO,
  PublicWorkshopWorkDTO,
  UpdateWorkshopVisibilityDTO,
  WorkshopCollectionDetailDTO,
  WorkshopColoringDetailDTO,
  WorkshopDTO,
  WorkshopModerationDecisionDTO,
  WorkshopModerationDetailDTO,
  WorkshopModerationListItemDTO,
  WorkshopReportDTO,
  WorkshopToolDTO,
  WorkshopWorkDTO,
} from "./dto";
import { PublicWorkshopService } from "./public-workshop.service";
import { WorkshopAdminGuard } from "./workshop-admin.guard";
import { WorkshopModerationService } from "./workshop-moderation.service";
import type { WorkshopUploadedFile } from "./workshop-media.service";
import { WorkshopService } from "./workshop.service";

type AuthenticatedRequest = { user: AuthUser };
type HeaderResponse = { setHeader(name: string, value: string): void };

const csrfHeader = ApiHeader({
  name: "x-artmate-csrf",
  required: true,
  schema: { default: "1", enum: ["1"] },
});

function WorkshopAssetHeaders() {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    Header("Cache-Control", "private, no-store")(target, propertyKey, descriptor);
    Header("Content-Type", "image/webp")(target, propertyKey, descriptor);
    Header("X-Content-Type-Options", "nosniff")(target, propertyKey, descriptor);
    Header("X-Robots-Tag", "noindex, noimageindex")(target, propertyKey, descriptor);
  };
}

@ApiTags("My workshop")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("workshops")
export class WorkshopController {
  constructor(private readonly workshops: WorkshopService) {}

  @ValidateResponse(WorkshopDTO)
  @ApiOkResponse({ type: WorkshopDTO })
  @Get("me")
  getMine(@Req() request: AuthenticatedRequest) {
    return this.workshops.getMine(request.user.id);
  }

  @ValidateResponse(WorkshopDTO)
  @ApiOkResponse({ type: WorkshopDTO })
  @csrfHeader
  @Patch("me/visibility")
  updateVisibility(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateWorkshopVisibilityDTO,
  ) {
    return this.workshops.updateVisibility(request.user.id, body);
  }

  @ValidateResponse(WorkshopCollectionDetailDTO)
  @ApiCreatedResponse({ type: WorkshopCollectionDetailDTO })
  @csrfHeader
  @Post("me/collections")
  addCollection(
    @Req() request: AuthenticatedRequest,
    @Body() body: AddWorkshopCollectionDTO,
  ) {
    return this.workshops.addCollection(request.user.id, body);
  }

  @ValidateResponse(WorkshopCollectionDetailDTO)
  @ApiOkResponse({ type: WorkshopCollectionDetailDTO })
  @Get("me/collections/:collectionSlug")
  getCollection(
    @Req() request: AuthenticatedRequest,
    @Param("collectionSlug") collectionSlug: string,
  ) {
    return this.workshops.getCollection(request.user.id, collectionSlug);
  }

  @ValidateResponse(WorkshopColoringDetailDTO)
  @ApiOkResponse({ type: WorkshopColoringDetailDTO })
  @Get("me/collections/:collectionSlug/colorings/:number")
  getColoring(
    @Req() request: AuthenticatedRequest,
    @Param("collectionSlug") collectionSlug: string,
    @Param("number") number: string,
  ) {
    return this.workshops.getColoring(
      request.user.id,
      collectionSlug,
      this.parseNumber(number),
    );
  }

  @ValidateResponse(WorkshopWorkDTO)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["payload"],
      properties: {
        photo: { type: "string", format: "binary" },
        payload: { type: "string", description: "JSON revision payload" },
      },
    },
  })
  @ApiCreatedResponse({ type: WorkshopWorkDTO })
  @csrfHeader
  @Post("me/collections/:collectionSlug/colorings/:number/revisions")
  @UseInterceptors(
    FileInterceptor("photo", {
      limits: {
        fieldSize: 64 * 1024,
        fields: 1,
        fileSize: 10 * 1024 * 1024,
        files: 1,
        parts: 3,
      },
    }),
  )
  createRevision(
    @Req() request: AuthenticatedRequest,
    @Param("collectionSlug") collectionSlug: string,
    @Param("number") number: string,
    @Body() body: CreateWorkshopRevisionMultipartDTO,
    @UploadedFile() photo: WorkshopUploadedFile | undefined,
  ) {
    return this.workshops.createRevision(
      request.user.id,
      collectionSlug,
      this.parseNumber(number),
      body.payload,
      photo,
    );
  }

  @ValidateResponse(WorkshopWorkDTO)
  @ApiOkResponse({ type: WorkshopWorkDTO })
  @csrfHeader
  @HttpCode(HttpStatus.OK)
  @Post("me/works/:workId/publish")
  publish(@Req() request: AuthenticatedRequest, @Param("workId") workId: string) {
    return this.workshops.publish(request.user.id, workId);
  }

  @ValidateResponse(WorkshopWorkDTO)
  @ApiOkResponse({ type: WorkshopWorkDTO })
  @csrfHeader
  @HttpCode(HttpStatus.OK)
  @Post("me/works/:workId/unpublish")
  unpublish(@Req() request: AuthenticatedRequest, @Param("workId") workId: string) {
    return this.workshops.unpublish(request.user.id, workId);
  }

  @csrfHeader
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("me/works/:workId")
  async delete(@Req() request: AuthenticatedRequest, @Param("workId") workId: string) {
    await this.workshops.deleteWork(request.user.id, workId);
  }

  @ValidateResponse(WorkshopToolDTO, { isArray: true })
  @ApiOkResponse({ type: [WorkshopToolDTO] })
  @Get("me/tools")
  getTools(@Req() request: AuthenticatedRequest) {
    return this.workshops.getTools(request.user.id);
  }

  @ValidateResponse(WorkshopToolDTO)
  @ApiCreatedResponse({ type: WorkshopToolDTO })
  @csrfHeader
  @Post("me/tools")
  createTool(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateWorkshopToolDTO,
  ) {
    return this.workshops.createTool(request.user.id, body);
  }

  @WorkshopAssetHeaders()
  @ApiParam({ name: "variant", enum: ["normalized", "web", "thumb"] })
  @ApiOkResponse({ content: { "image/webp": { schema: { type: "string", format: "binary" } } } })
  @ApiNotFoundResponse()
  @Get("me/revisions/:revisionId/assets/:variant")
  async getAsset(
    @Req() request: AuthenticatedRequest,
    @Param("revisionId") revisionId: string,
    @Param("variant") variant: string,
  ) {
    const buffer = await this.workshops.getOwnerAsset(request.user.id, revisionId, variant);
    return new StreamableFile(buffer, { type: "image/webp", length: buffer.length });
  }

  @ValidateResponse(MarkerColorDTO, { isArray: true })
  @ApiOkResponse({ type: [MarkerColorDTO] })
  @Get("marker-colors")
  getMarkerColors() {
    return this.workshops.getMarkerColors();
  }

  private parseNumber(value: string) {
    const number = parseColoringNumberSegment(value);
    if (number === null) {
      throw new NotFoundException("Workshop resource not found");
    }
    return number;
  }
}

@ApiTags("Artmate club")
@Controller("club")
export class PublicWorkshopController {
  constructor(private readonly workshops: PublicWorkshopService) {}

  @ValidateResponse(PublicWorkshopDTO)
  @ApiOkResponse({ type: PublicWorkshopDTO })
  @Get(":handle")
  getWorkshop(
    @Param("handle") handle: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    response.setHeader("Cache-Control", "no-store");
    return this.workshops.getWorkshop(handle);
  }

  @ValidateResponse(PublicWorkshopWorkDTO)
  @ApiOkResponse({ type: PublicWorkshopWorkDTO })
  @Get("works/:publicId")
  getWork(
    @Param("publicId") publicId: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    response.setHeader("Cache-Control", "no-store");
    return this.workshops.getWork(publicId);
  }

  @WorkshopAssetHeaders()
  @ApiParam({ name: "variant", enum: ["web", "thumb"] })
  @Get("works/:publicId/assets/:variant")
  async getAsset(
    @Param("publicId") publicId: string,
    @Param("variant") variant: string,
  ) {
    const buffer = await this.workshops.getAsset(publicId, variant);
    return new StreamableFile(buffer, { type: "image/webp", length: buffer.length });
  }

  @ValidateResponse(PublicWorkshopWorkDTO, { isArray: true })
  @ApiOkResponse({ type: [PublicWorkshopWorkDTO] })
  @Get("colorings/:collectionSlug/:number/works")
  getColoringWorks(
    @Param("collectionSlug") collectionSlug: string,
    @Param("number") value: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    response.setHeader("Cache-Control", "no-store");
    const number = parseColoringNumberSegment(value);
    if (number === null) {
      throw new NotFoundException("Club resource not found");
    }
    return this.workshops.getColoringWorks(collectionSlug, number);
  }

  @ValidateResponse(WorkshopReportDTO)
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Header("Cache-Control", "private, no-store")
  @ApiCreatedResponse({ type: WorkshopReportDTO })
  @csrfHeader
  @Post("works/:publicId/reports")
  report(
    @Req() request: AuthenticatedRequest,
    @Param("publicId") publicId: string,
    @Body() body: CreateWorkshopReportDTO,
  ) {
    return this.workshops.report(publicId, request.user.id, body);
  }
}

@ApiTags("Workshop moderation")
@ApiBearerAuth()
@UseGuards(AuthGuard, WorkshopAdminGuard)
@Controller("admin/workshop-moderation")
export class WorkshopModerationController {
  constructor(private readonly moderation: WorkshopModerationService) {}

  @ValidateResponse(WorkshopModerationListItemDTO, { isArray: true })
  @ApiOkResponse({ type: [WorkshopModerationListItemDTO] })
  @Get()
  list(@Query("status") status?: string) {
    return this.moderation.list(status);
  }

  @ValidateResponse(WorkshopModerationDetailDTO)
  @ApiOkResponse({ type: WorkshopModerationDetailDTO })
  @Get(":revisionId")
  get(@Param("revisionId") revisionId: string) {
    return this.moderation.get(revisionId);
  }

  @ValidateResponse(WorkshopModerationDetailDTO)
  @ApiOkResponse({ type: WorkshopModerationDetailDTO })
  @csrfHeader
  @HttpCode(HttpStatus.OK)
  @Post(":revisionId/decision")
  decide(
    @Req() request: AuthenticatedRequest,
    @Param("revisionId") revisionId: string,
    @Body() body: WorkshopModerationDecisionDTO,
  ) {
    return this.moderation.decide(revisionId, request.user.id, body);
  }

  @WorkshopAssetHeaders()
  @ApiParam({ name: "variant", enum: ["normalized", "web", "thumb", "official"] })
  @Get(":revisionId/assets/:variant")
  async getAsset(
    @Param("revisionId") revisionId: string,
    @Param("variant") variant: string,
  ) {
    const buffer = await this.moderation.getAsset(revisionId, variant);
    return new StreamableFile(buffer, { type: "image/webp", length: buffer.length });
  }
}
