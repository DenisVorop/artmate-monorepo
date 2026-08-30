import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ValidateResponse } from "../common/response-validation.interceptor";

import {
  PublicColoringCollectionDTO,
  PublicColoringCollectionSummaryDTO,
} from "./dto";
import { PublicColoringCollectionsService } from "./public-coloring-collections.service";

@ApiTags("Public coloring collections")
@Controller("coloring-collections")
export class PublicColoringCollectionsController {
  constructor(
    private readonly collectionsService: PublicColoringCollectionsService,
  ) {}

  @ValidateResponse(PublicColoringCollectionSummaryDTO, {
    isArray: true,
    conditionalGet: true,
  })
  @ApiOperation({ summary: "List published coloring collections" })
  @ApiOkResponse({ type: [PublicColoringCollectionSummaryDTO] })
  @ApiResponse({ status: 304, description: "Not modified" })
  @ApiServiceUnavailableResponse({
    description: "Coloring collection data is unavailable",
  })
  @Get()
  getCollections() {
    return this.collectionsService.getCollections();
  }

  @ValidateResponse(PublicColoringCollectionDTO, { conditionalGet: true })
  @ApiOperation({ summary: "Get a published coloring collection" })
  @ApiOkResponse({ type: PublicColoringCollectionDTO })
  @ApiResponse({ status: 304, description: "Not modified" })
  @ApiNotFoundResponse({ description: "Coloring collection not found" })
  @ApiServiceUnavailableResponse({
    description: "Coloring collection data is unavailable",
  })
  @Get(":slug")
  getCollection(@Param("slug") slug: string) {
    return this.collectionsService.getCollection(slug);
  }
}
