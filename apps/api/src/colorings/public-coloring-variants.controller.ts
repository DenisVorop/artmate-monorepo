import {
  Controller,
  Get,
  Header,
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
  ApiTags,
} from "@nestjs/swagger";
import {
  createNamespacedStrongEtag,
  matchesIfNoneMatch,
} from "../common/conditional-get";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { parseColoringNumberSegment } from "./coloring-number";
import { PublicColoringVariantsDTO } from "./dto/public-coloring-variant.dto";
import { PublicColoringVariantsService } from "./public-coloring-variants.service";

type PublicRequest = { headers: { "if-none-match"?: string }; method: string };
type PublicResponse = {
  setHeader(name: string, value: string | number): void;
  statusCode: number;
};

@ApiTags("Public coloring variants")
@Controller("colorings/:collectionSlug/:number/variants")
export class PublicColoringVariantsController {
  constructor(private readonly variants: PublicColoringVariantsService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Get the current published original and material variants",
  })
  @ApiOkResponse({ type: PublicColoringVariantsDTO })
  @ApiNotFoundResponse()
  @ValidateResponse(PublicColoringVariantsDTO)
  getColoring(
    @Param("collectionSlug") slug: string,
    @Param("number") number: string,
  ) {
    return this.variants.getColoring(slug, this.parseNumber(number));
  }

  @Get("assets/:target/:kind/:checksum/content")
  @ApiOperation({ summary: "Read a current published variant derivative" })
  @ApiParam({ name: "kind", enum: ["outline", "colored", "card"] })
  @ApiOkResponse({
    content: { "image/webp": { schema: { type: "string", format: "binary" } } },
  })
  @ApiResponse({ status: 304, description: "Not modified" })
  @ApiNotFoundResponse()
  async getAsset(
    @Param("collectionSlug") slug: string,
    @Param("number") number: string,
    @Param("target") target: string,
    @Param("kind") kind: string,
    @Param("checksum") checksum: string,
    @Req() request: PublicRequest,
    @Res({ passthrough: true }) response: PublicResponse,
  ) {
    response.setHeader("Cache-Control", "no-store");
    // Eligibility is rechecked before conditional responses, including HEAD and 304.
    const asset = await this.variants.getAssetDescriptor(
      slug,
      this.parseNumber(number),
      target,
      kind,
      checksum,
    );
    const etag = createNamespacedStrongEtag(
      "artmate-coloring-variant",
      asset.checksum,
    );
    const success = () => {
      response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      response.setHeader("Content-Type", "image/webp");
      response.setHeader("ETag", etag);
    };
    if (matchesIfNoneMatch(request.headers["if-none-match"], etag)) {
      success();
      response.statusCode = 304;
      return;
    }
    if (request.method === "HEAD") {
      success();
      response.setHeader("Content-Length", asset.byteSize);
      return;
    }
    const buffer = await this.variants.readAsset(asset);
    success();
    response.setHeader("Content-Length", buffer.length);
    return new StreamableFile(buffer, {
      type: "image/webp",
      length: buffer.length,
    });
  }

  private parseNumber(value: string) {
    const number = parseColoringNumberSegment(value);
    if (number === null) throw new NotFoundException("Coloring not found");
    return number;
  }
}
