import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
  StreamableFile,
} from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";

import {
  createNamespacedStrongEtag,
  matchesIfNoneMatch,
} from "../common/conditional-get";
import { ValidateResponse } from "../common/response-validation.interceptor";

import { parseColoringNumberSegment } from "./coloring-number";
import { PublicColoringDTO, PublicColoringManifestItemDTO } from "./dto";
import {
  PublicColoringsService,
  type PublicColoringAssetDescriptor,
} from "./public-colorings.service";

type PublicRequest = {
  headers: { "if-none-match"?: string };
  method: string;
};

type PublicResponse = {
  setHeader(name: string, value: string | number): void;
  statusCode: number;
};

const assetCacheControl = "public, max-age=31536000, immutable";
const assetEtagNamespace = "artmate-coloring-public-asset-v2";

@ApiTags("Public colorings")
@Controller("colorings")
export class PublicColoringsController {
  constructor(
    private readonly publicColoringsService: PublicColoringsService,
  ) {}

  @ValidateResponse(PublicColoringManifestItemDTO, {
    isArray: true,
    conditionalGet: true,
  })
  @ApiOperation({ summary: "List published colorings" })
  @ApiOkResponse({ type: [PublicColoringManifestItemDTO] })
  @ApiResponse({ status: 304, description: "Not modified" })
  @ApiNotFoundResponse({ description: "Coloring not found" })
  @ApiServiceUnavailableResponse({
    description: "Coloring data is unavailable",
  })
  @Get()
  getManifest() {
    return this.publicColoringsService.getManifest();
  }

  @ValidateResponse(PublicColoringDTO, { conditionalGet: true })
  @ApiOperation({ summary: "Get a published coloring" })
  @ApiOkResponse({ type: PublicColoringDTO })
  @ApiResponse({ status: 304, description: "Not modified" })
  @ApiNotFoundResponse({ description: "Coloring not found" })
  @ApiServiceUnavailableResponse({
    description: "Coloring data is unavailable",
  })
  @ApiParam({ name: "number", example: "01" })
  @Get(":collectionSlug/:number")
  getColoring(
    @Param("collectionSlug") collectionSlug: string,
    @Param("number") numberSegment: string,
  ) {
    return this.publicColoringsService.getColoring(
      collectionSlug,
      this.parseNumber(numberSegment),
    );
  }

  @ApiOperation({ summary: "Read an immutable published coloring asset" })
  @ApiParam({ name: "kind", enum: ["outline", "colored", "card"] })
  @ApiOkResponse({
    description: "Immutable published WebP derivative",
    content: {
      "image/webp": { schema: { type: "string", format: "binary" } },
    },
  })
  @ApiResponse({ status: 304, description: "Not modified" })
  @ApiNotFoundResponse({ description: "Coloring asset not found" })
  @ApiServiceUnavailableResponse({
    description: "Coloring asset is unavailable",
  })
  @ApiParam({ name: "number", example: "01" })
  @Get(":collectionSlug/:number/assets/:revisionId/:kind/content")
  async getAsset(
    @Param("collectionSlug") collectionSlug: string,
    @Param("number") numberSegment: string,
    @Param("revisionId") revisionId: string,
    @Param("kind") kind: string,
    @Req() request: PublicRequest,
    @Res({ passthrough: true }) response: PublicResponse,
  ) {
    response.setHeader("Cache-Control", "no-store");

    const asset = await this.publicColoringsService.getAssetDescriptor(
      collectionSlug,
      this.parseNumber(numberSegment),
      revisionId,
      this.parseAssetKind(kind),
    );

    return this.serveAsset(asset, request, response);
  }

  private async serveAsset(
    asset: PublicColoringAssetDescriptor,
    request: PublicRequest,
    response: PublicResponse,
  ) {
    response.setHeader("Cache-Control", "no-store");

    const etag = createNamespacedStrongEtag(assetEtagNamespace, asset.checksum);
    const setSuccessHeaders = () => {
      response.setHeader("Cache-Control", assetCacheControl);
      response.setHeader("Content-Type", "image/webp");
      response.setHeader("ETag", etag);
    };

    if (matchesIfNoneMatch(request.headers["if-none-match"], etag)) {
      setSuccessHeaders();
      response.statusCode = 304;
      return;
    }

    if (request.method === "HEAD") {
      setSuccessHeaders();
      response.setHeader("Content-Length", asset.byteSize);
      return;
    }

    const buffer = await this.publicColoringsService.readAsset(asset);

    setSuccessHeaders();
    response.setHeader("Content-Length", buffer.length);
    return new StreamableFile(buffer, {
      type: "image/webp",
      length: buffer.length,
    });
  }

  private parseNumber(value: string) {
    const number = parseColoringNumberSegment(value);

    if (number === null) {
      throw new NotFoundException("Coloring not found");
    }

    return number;
  }

  private parseAssetKind(value: string) {
    if (value !== "outline" && value !== "colored" && value !== "card") {
      throw new NotFoundException("Coloring not found");
    }

    return value;
  }
}
