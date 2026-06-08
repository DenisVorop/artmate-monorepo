import { PartialType } from "@nestjs/swagger";

import { CreateCatalogLandingPageRequestDTO } from "./create-catalog-landing-page-request.dto";

export class UpdateCatalogLandingPageRequestDTO extends PartialType(
  CreateCatalogLandingPageRequestDTO,
) {}
