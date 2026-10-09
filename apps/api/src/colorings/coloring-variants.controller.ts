import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Req,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { AdminColoringsGuard } from "./admin-colorings.guard";
import {
  ColoringVariantsService,
  type VariantUploadFiles,
} from "./coloring-variants.service";
import {
  ColoringVariantsDTO,
  SaveColoringVariantDTO,
  PublishColoringVariantDTO,
} from "./dto/coloring-variant.dto";

@ApiTags("Coloring variants")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Authentication required" })
@ApiForbiddenResponse({ description: "Admin role and CSRF header required" })
@UseGuards(AuthGuard, AdminColoringsGuard)
@Controller("admin/colorings/:coloringId/variants")
export class AdminColoringVariantsController {
  constructor(private readonly variants: ColoringVariantsService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({ summary: "Get mutable original and material variants" })
  @ApiOkResponse({ type: ColoringVariantsDTO })
  @ApiNotFoundResponse()
  @ValidateResponse(ColoringVariantsDTO)
  get(@Param("coloringId") coloringId: string) {
    return this.variants.get(coloringId);
  }

  @Post()
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({
    summary:
      "Create or replace an original or material variant without revisions",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: [
        "outline",
        "colored",
        "target",
        "expectedToken",
        "outlineAlt",
        "imageAlt",
        "palette",
      ],
      properties: {
        outline: { type: "string", format: "binary" },
        colored: { type: "string", format: "binary" },
        target: { type: "string", description: "original or material set ID" },
        expectedToken: { type: "string" },
        outlineAlt: { type: "string", maxLength: 220 },
        imageAlt: { type: "string", maxLength: 220 },
        palette: {
          type: "string",
          description:
            "JSON rows: symbolPosition plus hex (original) or materialColorId (adaptation)",
        },
      },
    },
  })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { enum: ["1"] },
  })
  @ApiOkResponse({ type: ColoringVariantsDTO })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiNotFoundResponse()
  @ApiPayloadTooLargeResponse()
  @ValidateResponse(ColoringVariantsDTO)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "outline", maxCount: 1 },
        { name: "colored", maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 20 * 1024 * 1024,
          files: 2,
          fields: 5,
          fieldSize: 16 * 1024,
          parts: 8,
        },
      },
    ),
  )
  save(
    @Param("coloringId") coloringId: string,
    @Body() input: SaveColoringVariantDTO,
    @UploadedFiles() files: VariantUploadFiles | undefined,
  ) {
    return this.variants.save(coloringId, input, files);
  }

  @Post(":target/publish")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({ summary: "Publish the current original or material variant" })
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { enum: ["1"] },
  })
  @ApiOkResponse({ type: ColoringVariantsDTO })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ValidateResponse(ColoringVariantsDTO)
  publish(
    @Param("coloringId") coloringId: string,
    @Param("target") target: string,
    @Body() input: PublishColoringVariantDTO,
    @Req() request: { user: AuthUser },
  ) {
    return this.variants.publish(coloringId, target, input, request.user.id);
  }

  @Get("assets/:target/:kind/content")
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({ summary: "Read current protected variant image" })
  @ApiOkResponse({
    content: { "image/webp": { schema: { type: "string", format: "binary" } } },
  })
  @ApiNotFoundResponse()
  async asset(
    @Param("coloringId") coloringId: string,
    @Param("target") target: string,
    @Param("kind") kind: string,
  ) {
    return new StreamableFile(
      await this.variants.asset(coloringId, target, kind),
      { type: "image/webp" },
    );
  }
}
